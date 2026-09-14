'use strict';

const user = require.main.require('./src/user');
const flags = require.main.require('./src/flags');
const events = require.main.require('./src/events');
const plugins = require.main.require('./src/plugins');
const winston = require.main.require('winston');

const scanner = require('./scanner');
const store = require('./store');

const MAX_RECORDED_ERRORS = 100;
// Per worker, so the forum keeps getting a slice of the event loop between deletions.
const DELETE_INTERVAL = 25;
// Job state lives in the database, not in this process: NodeBB may run several workers
// and the ACP poll can land on any of them. This is how often a running job flushes.
const FLUSH_INTERVAL = 500;

let current = null;

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

exports.status = function () {
	return store.read();
};

exports.isRunning = async function () {
	const state = await store.read();
	return !!state && store.isRunningStatus(state.status);
};

exports.cancel = async function () {
	if (!await exports.isRunning()) {
		return false;
	}
	if (current) {
		current.cancelRequested = true;
	}
	await store.requestCancel();
	return true;
};

exports.exportRows = function () {
	return store.readRows();
};

async function flush(job, force) {
	if (!force && Date.now() - job.lastFlush < FLUSH_INTERVAL) {
		return;
	}
	job.lastFlush = Date.now();

	// Read before writing: a cancel may have been requested on another worker.
	if (!job.cancelRequested && await store.readCancel()) {
		job.cancelRequested = true;
	}

	await store.write({
		id: job.id,
		status: job.status,
		startedAt: job.startedAt,
		finishedAt: job.finishedAt,
		dryRun: job.dryRun,
		purgeContent: job.purgeContent,
		concurrency: job.concurrency,
		filters: job.filters,
		total: job.total,
		scanned: job.scanned,
		matched: job.matched,
		toDelete: job.toDelete,
		protectedSkipped: job.protectedSkipped,
		deleted: job.deleted,
		failed: job.failed,
		skipped: job.skipped,
		errors: job.errors,
		message: job.message,
		expectedCount: job.expectedCount,
		sample: job.users.slice(0, 100),
		hasExport: job.users.length > 0,
	});
}

async function deleteOne(job, target) {
	// Defence in depth: group membership may have changed since the scan.
	const isProtected = await user.isPrivileged(target.uid);
	if (isProtected) {
		job.skipped += 1;
		return;
	}

	await flags.resolveFlag('user', target.uid, job.callerUid);

	const userData = job.purgeContent ?
		await user.delete(job.callerUid, target.uid) :
		await user.deleteAccount(target.uid);

	plugins.hooks.fire('action:user.delete', {
		callerUid: job.callerUid,
		uid: target.uid,
		ip: job.callerIp,
		user: userData || {},
	});

	await events.log({
		type: job.purgeContent ? 'user-delete' : 'user-deleteAccount',
		uid: job.callerUid,
		targetUid: target.uid,
		ip: job.callerIp,
		username: target.username,
		email: target.email,
		plugin: 'usercleaner',
	});
}

// The ACP user list deletes a selection by firing one API request per uid in parallel
// (public/src/admin/manage/users.js handleDelete), so concurrent user.delete calls are
// how core itself does it. There is no bulk delete to call instead.
async function deleteAll(job) {
	const queue = job.users.slice();
	const workerCount = Math.max(1, Math.min(job.concurrency, queue.length));

	const worker = async () => {
		while (queue.length) {
			if (job.cancelRequested) {
				job.status = 'cancelled';
				return;
			}
			const target = queue.shift();
			try {
				await deleteOne(job, target);
				job.deleted += 1;
			} catch (err) {
				job.failed += 1;
				if (job.errors.length < MAX_RECORDED_ERRORS) {
					job.errors.push({ uid: target.uid, username: target.username, message: err.message });
				}
				winston.error(`[plugin/usercleaner] failed to delete uid ${target.uid}: ${err.message}`);
			}
			await sleep(DELETE_INTERVAL);
			await flush(job);
		}
	};

	await Promise.all(Array.from({ length: workerCount }, worker));
}

async function run(job) {
	const isCancelled = () => job.cancelRequested;

	try {
		const protectedSet = await scanner.buildProtectedSet(job.callerUid);
		const result = await scanner.scan(job.filters, {
			callerUid: job.callerUid,
			protectedSet,
			collect: true,
			isCancelled,
			onProgress: async (progress) => {
				job.scanned = progress.scanned;
				job.total = progress.total;
				job.matched = progress.matched;
				job.protectedSkipped = progress.protectedSkipped;
				await flush(job);
			},
		});

		job.total = result.total;
		job.scanned = result.scanned;
		job.matched = result.matched;
		job.protectedSkipped = result.protectedSkipped;
		job.toDelete = result.toDelete;
		job.users = result.users;
		await store.writeRows(job.users);

		if (job.cancelRequested) {
			job.status = 'cancelled';
			return;
		}

		if (!job.dryRun && job.confirmCount !== job.matched) {
			job.status = 'aborted';
			job.message = '[[usercleaner:error.count-drifted]]';
			job.expectedCount = job.confirmCount;
			job.users = [];
			return;
		}

		if (job.dryRun) {
			job.status = 'completed';
			return;
		}

		job.status = 'deleting';
		await flush(job, true);
		await deleteAll(job);

		if (job.status === 'deleting') {
			job.status = 'completed';
		}
	} catch (err) {
		job.status = 'error';
		job.message = err.message;
		winston.error(`[plugin/usercleaner] job failed: ${err.stack}`);
	} finally {
		job.finishedAt = Date.now();
		await flush(job, true).catch(err => winston.error(`[plugin/usercleaner] ${err.stack}`));
		await events.log({
			type: 'usercleaner-run',
			uid: job.callerUid,
			ip: job.callerIp,
			dryRun: job.dryRun,
			status: job.status,
			matched: job.matched,
			deleted: job.deleted,
			failed: job.failed,
			purgeContent: job.purgeContent,
			filters: JSON.stringify(job.filters),
		}).catch(() => {});
	}
}

exports.start = async function (filters, { callerUid, callerIp, dryRun, confirmCount }) {
	if (await exports.isRunning()) {
		throw new Error('[[usercleaner:error.job-running]]');
	}

	current = {
		id: `${Date.now()}-${callerUid}`,
		startedAt: Date.now(),
		finishedAt: null,
		callerUid,
		callerIp,
		dryRun,
		purgeContent: filters.purgeContent,
		concurrency: filters.concurrency,
		confirmCount,
		filters,
		status: 'scanning',
		total: 0,
		scanned: 0,
		matched: 0,
		toDelete: 0,
		protectedSkipped: 0,
		deleted: 0,
		failed: 0,
		skipped: 0,
		errors: [],
		users: [],
		message: null,
		expectedCount: 0,
		cancelRequested: false,
		lastFlush: 0,
	};

	await flush(current, true);
	await store.resetCancel();
	await store.writeRows([]);

	// Deliberately not awaited: the ACP polls /job for progress.
	run(current);

	return current.id;
};
