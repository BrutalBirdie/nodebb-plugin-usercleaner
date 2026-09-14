'use strict';

const user = require.main.require('./src/user');
const flags = require.main.require('./src/flags');
const events = require.main.require('./src/events');
const plugins = require.main.require('./src/plugins');
const winston = require.main.require('winston');

const scanner = require('./scanner');

const MAX_RECORDED_ERRORS = 100;
// Per worker, so the forum keeps getting a slice of the event loop between deletions.
const DELETE_INTERVAL = 25;

let current = null;

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

exports.get = function () {
	return current;
};

exports.isRunning = function () {
	return !!current && (current.status === 'scanning' || current.status === 'deleting');
};

exports.cancel = function () {
	if (!exports.isRunning()) {
		return false;
	}
	current.cancelRequested = true;
	return true;
};

exports.status = function () {
	if (!current) {
		return null;
	}
	return {
		id: current.id,
		status: current.status,
		startedAt: current.startedAt,
		finishedAt: current.finishedAt,
		dryRun: current.dryRun,
		purgeContent: current.purgeContent,
		concurrency: current.concurrency,
		filters: current.filters,
		total: current.total,
		scanned: current.scanned,
		matched: current.matched,
		toDelete: current.toDelete,
		protectedSkipped: current.protectedSkipped,
		deleted: current.deleted,
		failed: current.failed,
		skipped: current.skipped,
		errors: current.errors,
		message: current.message,
		expectedCount: current.expectedCount,
		cancelRequested: current.cancelRequested,
		sample: current.users.slice(0, 100),
		hasExport: current.users.length > 0,
	};
};

exports.exportRows = function () {
	return current ? current.users : [];
};

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
			onProgress: (progress) => {
				job.scanned = progress.scanned;
				job.total = progress.total;
				job.matched = progress.matched;
				job.protectedSkipped = progress.protectedSkipped;
			},
		});

		job.total = result.total;
		job.scanned = result.scanned;
		job.matched = result.matched;
		job.protectedSkipped = result.protectedSkipped;
		job.toDelete = result.toDelete;
		job.users = result.users;

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

exports.start = function (filters, { callerUid, callerIp, dryRun, confirmCount }) {
	if (exports.isRunning()) {
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
		cancelRequested: false,
	};

	// Deliberately not awaited: the ACP polls /job for progress.
	run(current);

	return current.id;
};
