'use strict';

const DAY = 86400000;

// Selector value -> age in days. 'any' disables the check.
const PERIODS = {
	any: 0,
	'1m': 30,
	'3m': 90,
	'6m': 182,
	'1y': 365,
	'2y': 730,
	'3y': 1095,
	'5y': 1825,
	'10y': 3650,
};

const BANNED_MODES = ['any', 'only', 'exclude'];

const MAX_EMAIL_PATTERN_LENGTH = 500;

exports.PERIODS = PERIODS;

function toNonNegativeInt(value, fallback) {
	const num = parseInt(value, 10);
	if (!Number.isFinite(num) || num < 0) {
		return fallback;
	}
	return num;
}

function toBool(value) {
	return value === true || value === 'on' || value === 'true' || value === 1 || value === '1';
}

function toPeriodDays(value) {
	return PERIODS[value] === undefined ? 0 : PERIODS[value];
}

function toGroupList(value) {
	let raw = value;
	if (typeof raw === 'string' && raw.trim().startsWith('[')) {
		try {
			raw = JSON.parse(raw);
		} catch (_err) {
			// fall through to the delimiter split below
		}
	}
	if (!Array.isArray(raw)) {
		raw = String(raw || '').split(/[\r\n,]+/);
	}
	return raw.map(name => String(name).trim()).filter(Boolean);
}

exports.normalize = function (payload) {
	const data = payload || {};
	const bannedMode = BANNED_MODES.includes(data.bannedMode) ? data.bannedMode : 'any';

	return {
		maxPostcount: toNonNegativeInt(data.maxPostcount, 0),
		maxReputation: toNonNegativeInt(data.maxReputation, 0),
		maxTopiccount: toBool(data.useTopiccount) ? toNonNegativeInt(data.maxTopiccount, 0) : null,
		lastOnlineDays: toPeriodDays(data.lastOnlinePeriod),
		minAccountAgeDays: toPeriodDays(data.accountAgePeriod),
		emailUnconfirmedOnly: toBool(data.emailUnconfirmedOnly),
		neverLoggedInOnly: toBool(data.neverLoggedInOnly),
		profileSpamOnly: toBool(data.profileSpamOnly),
		emailPattern: String(data.emailPattern || '').trim().slice(0, MAX_EMAIL_PATTERN_LENGTH),
		bannedMode: bannedMode,
		minFlags: toNonNegativeInt(data.minFlags, 0),
		includeGroups: toGroupList(data.includeGroups),
		excludeGroups: toGroupList(data.excludeGroups),
		limit: Math.min(toNonNegativeInt(data.limit, 1000) || 1000, 100000),
		purgeContent: data.contentMode !== 'keep',
	};
};

// A filter set that matches every account is a foot-gun at 40k users; require at
// least one narrowing condition beyond the postcount/reputation ceilings.
exports.isTooBroad = function (filters) {
	return !filters.lastOnlineDays &&
		!filters.minAccountAgeDays &&
		!filters.emailUnconfirmedOnly &&
		!filters.neverLoggedInOnly &&
		!filters.profileSpamOnly &&
		!filters.emailPattern &&
		!filters.minFlags &&
		filters.bannedMode === 'any' &&
		!filters.includeGroups.length;
};

// Throws a translated error so the ACP can show the admin what is wrong with the pattern.
exports.emailRegex = function (filters) {
	if (!filters.emailPattern) {
		return null;
	}
	try {
		return new RegExp(filters.emailPattern, 'i');
	} catch (_err) {
		throw new Error('[[usercleaner:error.invalid-email-pattern]]');
	}
};

exports.cutoffs = function (filters, now) {
	return {
		lastOnline: filters.lastOnlineDays ? now - (filters.lastOnlineDays * DAY) : null,
		joindate: filters.minAccountAgeDays ? now - (filters.minAccountAgeDays * DAY) : null,
	};
};
