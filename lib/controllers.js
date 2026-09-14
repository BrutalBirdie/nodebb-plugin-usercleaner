'use strict';

const groups = require.main.require('./src/groups');

const filterUtils = require('./filters');

const PERIOD_ORDER = ['any', '1m', '3m', '6m', '1y', '2y', '3y', '5y', '10y'];

// Rendered by the template through the tx() helper, not translated here.
function periodOptions(selected) {
	return PERIOD_ORDER.map(value => ({
		value,
		label: `[[usercleaner:period.${value}]]`,
		selected: value === selected,
	}));
}

exports.renderAdminPage = function (req, res) {
	res.render('admin/plugins/usercleaner', {
		title: '[[usercleaner:title]]',
		lastOnlinePeriods: periodOptions('1y'),
		accountAgePeriods: periodOptions('1m'),
	});
};

exports.listGroups = async function () {
	const groupsData = await groups.getNonPrivilegeGroups('groups:createtime', 0, -1, { ephemeral: false });
	return groupsData
		.filter(group => group && group.name)
		.map(group => ({ name: group.name, memberCount: parseInt(group.memberCount, 10) || 0 }))
		.sort((a, b) => a.name.localeCompare(b.name));
};

exports.periodValues = filterUtils.PERIODS;
