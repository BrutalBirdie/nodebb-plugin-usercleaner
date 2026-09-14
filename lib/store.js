'use strict';

const db = require.main.require('./src/database');

const KEY = 'usercleaner:job';
const ROWS_KEY = 'usercleaner:job:rows';
const ROWS_PER_CHUNK = 200;
// A worker that dies mid-run leaves a 'deleting' record behind; without this the plugin
// would refuse every further run until the key is removed by hand.
const STALE_AFTER = 60000;

const NUMERIC = [
	'startedAt', 'finishedAt', 'concurrency', 'total', 'scanned', 'matched', 'toDelete',
	'protectedSkipped', 'deleted', 'failed', 'skipped', 'expectedCount', 'updatedAt',
];
const BOOLEAN = ['dryRun', 'purgeContent', 'cancel', 'hasExport'];
const JSON_FIELDS = ['filters', 'errors', 'sample'];

function toInt(value) {
	const num = parseInt(value, 10);
	return Number.isFinite(num) ? num : 0;
}

function parseJson(value, fallback) {
	if (value === undefined || value === null || value === '') {
		return fallback;
	}
	if (typeof value !== 'string') {
		return value;
	}
	try {
		return JSON.parse(value);
	} catch (_err) {
		return fallback;
	}
}

function serialize(state) {
	const data = { id: state.id, status: state.status, message: state.message || '' };
	NUMERIC.forEach((field) => { data[field] = toInt(state[field]); });
	// 'cancel' is owned by whichever worker requests the cancel; the worker running the
	// job must never write it back, or it overwrites a request made elsewhere.
	BOOLEAN.filter(field => field !== 'cancel')
		.forEach((field) => { data[field] = state[field] ? 1 : 0; });
	JSON_FIELDS.forEach((field) => { data[field] = JSON.stringify(state[field] || (field === 'filters' ? {} : [])); });
	return data;
}

function deserialize(data) {
	const state = { id: data.id, status: data.status, message: data.message || null };
	NUMERIC.forEach((field) => { state[field] = toInt(data[field]); });
	BOOLEAN.forEach((field) => { state[field] = toInt(data[field]) === 1; });
	state.filters = parseJson(data.filters, {});
	state.errors = parseJson(data.errors, []);
	state.sample = parseJson(data.sample, []);
	state.finishedAt = state.finishedAt || null;
	return state;
}

exports.isRunningStatus = function (status) {
	return status === 'scanning' || status === 'deleting';
};

exports.read = async function () {
	const data = await db.getObject(KEY);
	if (!data || !data.id) {
		return null;
	}

	const state = deserialize(data);
	if (exports.isRunningStatus(state.status) && Date.now() - state.updatedAt > STALE_AFTER) {
		state.status = 'error';
		state.message = '[[usercleaner:error.job-lost]]';
		state.finishedAt = state.updatedAt;
	}
	return state;
};

exports.write = async function (state) {
	state.updatedAt = Date.now();
	await db.setObject(KEY, serialize(state));
};

// Written once when the scan finishes, so the CSV export works from any worker.
exports.writeRows = async function (rows) {
	await db.delete(ROWS_KEY);
	for (let i = 0; i < rows.length; i += ROWS_PER_CHUNK) {
		await db.listAppend(ROWS_KEY, JSON.stringify(rows.slice(i, i + ROWS_PER_CHUNK)));
	}
};

exports.readRows = async function () {
	const chunks = await db.getListRange(ROWS_KEY, 0, -1);
	return (chunks || []).reduce((rows, chunk) => rows.concat(parseJson(chunk, [])), []);
};

exports.readCancel = async function () {
	return toInt(await db.getObjectField(KEY, 'cancel')) === 1;
};

exports.requestCancel = async function () {
	await db.setObjectField(KEY, 'cancel', 1);
};

exports.resetCancel = async function () {
	await db.setObjectField(KEY, 'cancel', 0);
};
