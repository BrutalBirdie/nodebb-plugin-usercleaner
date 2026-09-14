'use strict';

const db = require.main.require('./src/database');
const user = require.main.require('./src/user');
const groups = require.main.require('./src/groups');
const batch = require.main.require('./src/batch');

const filterUtils = require('./filters');

const USER_FIELDS = [
	'uid', 'username', 'userslug', 'email', 'email:confirmed', 'joindate', 'lastonline',
	'postcount', 'topiccount', 'reputation', 'banned', 'flags',
	'fullname', 'signature', 'aboutme', 'uploadedpicture',
];

const BATCH_SIZE = 500;
// lastonline is stamped at registration, so "never came back" needs a grace window.
const NEVER_LOGGED_IN_GRACE = 60000;

function toInt(value) {
	const num = parseInt(value, 10);
	return Number.isFinite(num) ? num : 0;
}

function isNonEmpty(value) {
	return typeof value === 'string' && value.trim().length > 0;
}

// Accounts that must never be touched, whatever the filters say.
async function buildProtectedSet(callerUid) {
	const [admins, globalMods, moderators] = await Promise.all([
		groups.getMembers('administrators', 0, -1),
		groups.getMembers('Global Moderators', 0, -1),
		user.getModeratorUids(),
	]);

	const protectedSet = new Set([...admins, ...globalMods, ...moderators].map(uid => toInt(uid)));
	protectedSet.add(toInt(callerUid));
	protectedSet.delete(0);
	return protectedSet;
}

exports.buildProtectedSet = buildProtectedSet;

// Registrations made with the default 'send' verification never write the address to
// user:<uid>.email - it only exists on the confirm object until the link is clicked.
// Mirrors getConfirmObjs() in src/controllers/admin/users.js.
async function getPendingEmails(uids) {
	const pending = new Map();
	const codes = await db.mget(uids.map(uid => `confirm:byUid:${uid}`));
	const wanted = uids.filter((_uid, index) => codes[index]);
	if (!wanted.length) {
		return pending;
	}

	const objects = await db.getObjects(codes.filter(Boolean).map(code => `confirm:${code}`));
	objects.forEach((obj, index) => {
		if (obj && obj.email) {
			pending.set(wanted[index], obj.email);
		}
	});
	return pending;
}

function matches(userData, filters, cutoffs) {
	const postcount = toInt(userData.postcount);
	const reputation = toInt(userData.reputation);
	const joindate = toInt(userData.joindate);
	const lastonline = toInt(userData.lastonline);

	if (postcount > filters.maxPostcount) {
		return false;
	}
	if (reputation > filters.maxReputation) {
		return false;
	}
	if (filters.maxTopiccount !== null && toInt(userData.topiccount) > filters.maxTopiccount) {
		return false;
	}
	if (cutoffs.joindate !== null && joindate > cutoffs.joindate) {
		return false;
	}
	if (cutoffs.lastOnline !== null && Math.max(lastonline, joindate) > cutoffs.lastOnline) {
		return false;
	}
	if (filters.neverLoggedInOnly && lastonline > joindate + NEVER_LOGGED_IN_GRACE) {
		return false;
	}
	if (filters.emailUnconfirmedOnly && toInt(userData['email:confirmed']) === 1) {
		return false;
	}
	if (filters.profileSpamOnly && !isNonEmpty(userData.fullname) && !isNonEmpty(userData.signature) &&
		!isNonEmpty(userData.aboutme) && !isNonEmpty(userData.uploadedpicture)) {
		return false;
	}
	if (filters.emailRegex && !filters.emailRegex.test(userData.email || '')) {
		return false;
	}
	if (filters.minFlags && toInt(userData.flags) < filters.minFlags) {
		return false;
	}

	const isBanned = toInt(userData.banned) === 1;
	if (filters.bannedMode === 'only' && !isBanned) {
		return false;
	}
	if (filters.bannedMode === 'exclude' && isBanned) {
		return false;
	}

	return true;
}

async function filterByGroups(candidates, filters) {
	let remaining = candidates;

	for (const groupName of filters.excludeGroups) {
		if (!remaining.length) {
			break;
		}
		const isMember = await groups.isMembers(remaining.map(u => u.uid), groupName);
		remaining = remaining.filter((_u, index) => !isMember[index]);
	}

	for (const groupName of filters.includeGroups) {
		if (!remaining.length) {
			break;
		}
		const isMember = await groups.isMembers(remaining.map(u => u.uid), groupName);
		remaining = remaining.filter((_u, index) => isMember[index]);
	}

	return remaining;
}

function summarize(userData) {
	return {
		uid: toInt(userData.uid),
		username: userData.username || '',
		userslug: userData.userslug || '',
		email: userData.email || '',
		emailPending: userData.emailPending === true,
		emailConfirmed: toInt(userData['email:confirmed']) === 1,
		joindate: toInt(userData.joindate),
		lastonline: toInt(userData.lastonline),
		postcount: toInt(userData.postcount),
		topiccount: toInt(userData.topiccount),
		reputation: toInt(userData.reputation),
		banned: toInt(userData.banned) === 1,
		flags: toInt(userData.flags),
	};
}

/**
 * Walks users:joindate in batches and applies the filter set.
 * `matched` counts every match; `users` is capped at filters.limit (the per-run ceiling).
 */
exports.scan = async function (filters, options) {
	const opts = options || {};
	const sampleSize = opts.sampleSize === undefined ? 0 : opts.sampleSize;
	const collect = opts.collect === true;
	const cutoffs = filterUtils.cutoffs(filters, Date.now());
	const emailRegex = filterUtils.emailRegex(filters);
	const effectiveFilters = { ...filters, emailRegex };
	const protectedSet = opts.protectedSet || await buildProtectedSet(opts.callerUid);

	const total = await db.sortedSetCard('users:joindate');
	const result = { total, scanned: 0, matched: 0, protectedSkipped: 0, users: [], sample: [] };

	const batchOptions = { batch: BATCH_SIZE, interval: opts.interval || 0 };
	if (opts.isCancelled) {
		// Also forces batch.js off its fast path, so `interval` is honoured.
		batchOptions.doneIf = () => opts.isCancelled();
	}

	await batch.processSortedSet('users:joindate', async (uids) => {
		const wanted = uids.map(uid => toInt(uid)).filter((uid) => {
			if (protectedSet.has(uid)) {
				result.protectedSkipped += 1;
				return false;
			}
			return uid > 0;
		});

		result.scanned += uids.length;

		if (wanted.length) {
			const usersData = await db.getObjectsFields(wanted.map(uid => `user:${uid}`), USER_FIELDS);

			if (emailRegex) {
				const pending = await getPendingEmails(wanted);
				usersData.forEach((userData, index) => {
					if (userData && !userData.email && pending.has(wanted[index])) {
						userData.email = pending.get(wanted[index]);
						userData.emailPending = true;
					}
				});
			}

			let candidates = usersData
				.filter(userData => userData && userData.uid)
				.filter(userData => matches(userData, effectiveFilters, cutoffs))
				.map(summarize);

			if (filters.excludeGroups.length || filters.includeGroups.length) {
				candidates = await filterByGroups(candidates, filters);
			}

			for (const candidate of candidates) {
				result.matched += 1;
				if (result.sample.length < sampleSize) {
					result.sample.push(candidate);
				}
				if (collect && result.users.length < filters.limit) {
					result.users.push(candidate);
				}
			}
		}

		if (opts.onProgress) {
			opts.onProgress(result);
		}
	}, batchOptions);

	result.toDelete = Math.min(result.matched, filters.limit);
	return result;
};
