'use strict';

const privileges = require.main.require('./src/privileges');
const routeHelpers = require.main.require('./src/routes/helpers');
const controllerHelpers = require.main.require('./src/controllers/helpers');

const controllers = require('./lib/controllers');
const filterUtils = require('./lib/filters');
const scanner = require('./lib/scanner');
const job = require('./lib/job');

const PREVIEW_SAMPLE_SIZE = 50;

const plugin = {};

plugin.init = async ({ router }) => {
	routeHelpers.setupAdminPageRoute(router, '/admin/plugins/usercleaner', controllers.renderAdminPage);
};

plugin.addRoutes = async ({ router, middleware, helpers }) => {
	const ensureAdmin = async (req, res, next) => {
		const allowed = await privileges.admin.can('admin:users', req.uid);
		if (!allowed) {
			return controllerHelpers.formatApiResponse(403, res, new Error('[[error:no-privileges]]'));
		}
		next();
	};

	const guard = [middleware.ensureLoggedIn, ensureAdmin];

	routeHelpers.setupApiRoute(router, 'get', '/usercleaner/groups', guard, async (req, res) => {
		helpers.formatApiResponse(200, res, { groups: await controllers.listGroups() });
	});

	routeHelpers.setupApiRoute(router, 'post', '/usercleaner/preview', guard, async (req, res) => {
		const filters = filterUtils.normalize(req.body);
		if (filterUtils.isTooBroad(filters)) {
			return helpers.formatApiResponse(400, res, new Error('[[usercleaner:error.filters-too-broad]]'));
		}

		const result = await scanner.scan(filters, {
			callerUid: req.uid,
			sampleSize: PREVIEW_SAMPLE_SIZE,
		});

		helpers.formatApiResponse(200, res, {
			filters,
			total: result.total,
			matched: result.matched,
			toDelete: result.toDelete,
			protectedSkipped: result.protectedSkipped,
			sample: result.sample,
		});
	});

	// Static path first so it is not shadowed by /usercleaner/job.
	routeHelpers.setupApiRoute(router, 'get', '/usercleaner/job/export', guard, async (req, res) => {
		const rows = job.exportRows();
		const header = 'uid,username,email,emailConfirmed,joindate,lastonline,postcount,topiccount,reputation,banned,flags\n';
		const body = rows.map(row => [
			row.uid,
			csvCell(row.username),
			csvCell(row.email),
			row.emailConfirmed,
			toIso(row.joindate),
			toIso(row.lastonline),
			row.postcount,
			row.topiccount,
			row.reputation,
			row.banned,
			row.flags,
		].join(',')).join('\n');

		res.set('Content-Type', 'text/csv; charset=utf-8');
		res.set('Content-Disposition', 'attachment; filename="usercleaner-matches.csv"');
		res.send(header + body);
	});

	routeHelpers.setupApiRoute(router, 'get', '/usercleaner/job', guard, async (req, res) => {
		helpers.formatApiResponse(200, res, { job: job.status() });
	});

	routeHelpers.setupApiRoute(router, 'post', '/usercleaner/job', guard, async (req, res) => {
		if (job.isRunning()) {
			return helpers.formatApiResponse(409, res, new Error('[[usercleaner:error.job-running]]'));
		}

		const filters = filterUtils.normalize(req.body);
		if (filterUtils.isTooBroad(filters)) {
			return helpers.formatApiResponse(400, res, new Error('[[usercleaner:error.filters-too-broad]]'));
		}

		const dryRun = req.body.dryRun !== false && req.body.dryRun !== 'false';
		const confirmCount = parseInt(req.body.confirmCount, 10);

		if (!dryRun) {
			if (req.body.confirmPhrase !== 'DELETE') {
				return helpers.formatApiResponse(400, res, new Error('[[usercleaner:error.confirm-phrase]]'));
			}
			if (!Number.isFinite(confirmCount) || confirmCount < 1) {
				return helpers.formatApiResponse(400, res, new Error('[[usercleaner:error.confirm-count]]'));
			}
		}

		const id = job.start(filters, {
			callerUid: req.uid,
			callerIp: req.ip,
			dryRun,
			confirmCount,
		});

		helpers.formatApiResponse(200, res, { id, job: job.status() });
	});

	routeHelpers.setupApiRoute(router, 'delete', '/usercleaner/job', guard, async (req, res) => {
		helpers.formatApiResponse(200, res, { cancelled: job.cancel(), job: job.status() });
	});
};

plugin.addAdminNavigation = (header) => {
	header.plugins.push({
		route: '/plugins/usercleaner',
		icon: 'fa-user-times',
		name: '[[usercleaner:menu.title]]',
	});
	return header;
};

function csvCell(value) {
	return `"${String(value === undefined || value === null ? '' : value).replace(/"/g, '""')}"`;
}

function toIso(timestamp) {
	const num = parseInt(timestamp, 10);
	return num > 0 ? new Date(num).toISOString() : '';
}

module.exports = plugin;
