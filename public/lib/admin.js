'use strict';

import { save, load } from 'settings';
import { get, post, del } from 'api';
import * as alerts from 'alerts';
import { dialog } from 'modals';

const POLL_INTERVAL = 1000;

let pollTimer = null;
let lastPreview = null;

export function init() {
	loadGroups().then(() => load('usercleaner', $('.usercleaner-settings')));

	$('#save').on('click', (e) => {
		e.preventDefault();
		save('usercleaner', $('.usercleaner-settings'));
	});

	$('#preview').on('click', (e) => {
		e.preventDefault();
		runPreview();
	});

	$('#run').on('click', (e) => {
		e.preventDefault();
		confirmAndRun();
	});

	$('#cancel').on('click', (e) => {
		e.preventDefault();
		del('/plugins/usercleaner/job', {}).then(refresh).catch(showError);
	});

	$('#export').attr('href', `${config.relative_path}/api/v3/plugins/usercleaner/job/export`);

	$(window).one('action:ajaxify.start', stopPolling);

	refresh();
}

function collect() {
	return {
		maxPostcount: $('#maxPostcount').val(),
		maxReputation: $('#maxReputation').val(),
		useTopiccount: $('#useTopiccount').is(':checked'),
		maxTopiccount: $('#maxTopiccount').val(),
		lastOnlinePeriod: $('#lastOnlinePeriod').val(),
		accountAgePeriod: $('#accountAgePeriod').val(),
		emailUnconfirmedOnly: $('#emailUnconfirmedOnly').is(':checked'),
		neverLoggedInOnly: $('#neverLoggedInOnly').is(':checked'),
		profileSpamOnly: $('#profileSpamOnly').is(':checked'),
		bannedMode: $('#bannedMode').val(),
		minFlags: $('#minFlags').val(),
		includeGroups: $('#includeGroups').val() || [],
		excludeGroups: $('#excludeGroups').val() || [],
		contentMode: $('#contentMode').val(),
		limit: $('#limit').val(),
	};
}

async function loadGroups() {
	try {
		const { groups } = await get('/plugins/usercleaner/groups', {});
		const options = groups.map(group => $('<option>').val(group.name).text(`${group.name} (${group.memberCount})`));
		$('#includeGroups').append(options.map(o => o.clone()));
		$('#excludeGroups').append(options);
	} catch (err) {
		showError(err);
	}
}

async function runPreview() {
	const button = $('#preview').prop('disabled', true);
	try {
		lastPreview = await post('/plugins/usercleaner/preview', collect());
		renderStats(lastPreview);
		renderSample(lastPreview.sample);
		$('#export').addClass('hidden');
	} catch (err) {
		showError(err);
	} finally {
		button.prop('disabled', false);
	}
}

function confirmAndRun() {
	const dryRun = $('#dryRun').is(':checked');

	if (dryRun) {
		return start(true, 0);
	}

	if (!lastPreview || !lastPreview.toDelete) {
		return alerts.warning('[[usercleaner:error.preview-first]]');
	}

	const count = lastPreview.matched;
	const contentWarning = $('#contentMode').val() === 'purge' ?
		'[[usercleaner:confirm.purge-warning]]' : '[[usercleaner:confirm.keep-warning]]';

	dialog({
		title: '[[usercleaner:confirm.title]]',
		message: `
			<div class="alert alert-danger">[[usercleaner:confirm.body, ${lastPreview.toDelete}]]</div>
			<p>${contentWarning}</p>
			<div class="mb-3">
				<label class="form-label" for="confirm-count">[[usercleaner:confirm.type-count, ${count}]]</label>
				<input type="text" class="form-control" id="confirm-count" autocomplete="off" />
			</div>
			<div>
				<label class="form-label" for="confirm-phrase">[[usercleaner:confirm.type-delete]]</label>
				<input type="text" class="form-control" id="confirm-phrase" autocomplete="off" />
			</div>`,
		buttons: {
			cancel: {
				label: '[[global:buttons.cancel]]',
				className: 'btn-link',
			},
			confirm: {
				label: '[[usercleaner:confirm.proceed]]',
				className: 'btn-danger',
				callback: function () {
					if ($('#confirm-count').val().trim() !== String(count)) {
						alerts.error('[[usercleaner:error.confirm-count]]');
						return false;
					}
					if ($('#confirm-phrase').val().trim() !== 'DELETE') {
						alerts.error('[[usercleaner:error.confirm-phrase]]');
						return false;
					}
					start(false, count);
				},
			},
		},
	});
}

async function start(dryRun, confirmCount) {
	try {
		await post('/plugins/usercleaner/job', {
			...collect(),
			dryRun,
			confirmPhrase: dryRun ? '' : 'DELETE',
			confirmCount,
		});
		startPolling();
	} catch (err) {
		showError(err);
	}
}

function startPolling() {
	stopPolling();
	pollTimer = setInterval(refresh, POLL_INTERVAL);
	refresh();
}

function stopPolling() {
	if (pollTimer) {
		clearInterval(pollTimer);
		pollTimer = null;
	}
}

async function refresh() {
	try {
		const { job } = await get('/plugins/usercleaner/job', {});
		renderJob(job);
		if (job && (job.status === 'scanning' || job.status === 'deleting')) {
			if (!pollTimer) {
				startPolling();
			}
		} else {
			stopPolling();
		}
	} catch (err) {
		stopPolling();
		showError(err);
	}
}

function renderStats(data) {
	$('#results-empty').addClass('hidden');
	$('#results').removeClass('hidden');
	$('#stat-total').text(data.total);
	$('#stat-matched').text(data.matched);
	$('#stat-todelete').text(data.toDelete);
	$('#stat-protected').text(data.protectedSkipped);
}

function renderSample(sample) {
	const body = $('#sample-body').empty();
	if (!sample || !sample.length) {
		$('#sample-card').addClass('hidden');
		return;
	}
	sample.forEach((row) => {
		$('<tr>').append(
			$('<td>').append($('<a>')
				.attr('href', `${config.relative_path}/uid/${row.uid}`)
				.attr('target', '_blank')
				.text(row.username || `uid ${row.uid}`)),
			$('<td class="text-end">').text(row.postcount),
			$('<td class="text-end">').text(row.reputation),
			$('<td class="text-end">').text(formatDate(row.lastonline || row.joindate))
		).appendTo(body);
	});
	$('#sample-card').removeClass('hidden');
}

function renderJob(job) {
	if (!job) {
		$('#progress-card').addClass('hidden');
		return;
	}

	const running = job.status === 'scanning' || job.status === 'deleting';
	$('#progress-card').removeClass('hidden');
	$('#cancel').toggleClass('hidden', !running);
	$('#run').prop('disabled', running);
	$('#preview').prop('disabled', running);

	const current = job.status === 'deleting' ? job.deleted : job.scanned;
	const target = job.status === 'deleting' ? Math.max(job.toDelete, 1) : Math.max(job.total, 1);
	const percent = Math.min(100, Math.round((current / target) * 100));

	$('#progress-bar')
		.css('width', `${running ? percent : 100}%`)
		.toggleClass('progress-bar-animated progress-bar-striped', running)
		.toggleClass('bg-danger', job.status === 'error' || job.status === 'aborted')
		.toggleClass('bg-success', job.status === 'completed');

	$('#progress-title').translateText(`[[usercleaner:status.${job.status}]]${job.dryRun ? ' [[usercleaner:status.dry-run-suffix]]' : ''}`);
	$('#progress-text').translateText(
		`[[usercleaner:progress.text, ${job.scanned}, ${job.total}, ${job.matched}, ${job.deleted}, ${job.failed}]]`
	);

	const errorText = job.message ? [job.message] : [];
	job.errors.slice(0, 10).forEach(e => errorText.push(`uid ${e.uid}: ${e.message}`));
	$('#progress-errors').translateHtml(errorText.join('<br />'));

	if (!running) {
		renderStats(job);
		renderSample(job.sample);
		$('#export').toggleClass('hidden', !job.hasExport);
		if (job.dryRun) {
			lastPreview = job;
		} else {
			// Never leave a real run armed: the next click must start from a dry run again.
			lastPreview = null;
			$('#dryRun').prop('checked', true);
		}
	}
}

function formatDate(timestamp) {
	const num = parseInt(timestamp, 10);
	return num > 0 ? new Date(num).toISOString().slice(0, 10) : '-';
}

function showError(err) {
	alerts.error(err.message || '[[error:invalid-data]]');
}
