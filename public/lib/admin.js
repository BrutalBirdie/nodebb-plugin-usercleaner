'use strict';

import { save, load } from 'settings';
import { get, post, del } from 'api';
import * as alerts from 'alerts';
import { dialog } from 'modals';

const POLL_INTERVAL = 1000;

const STATUS_LABELS = {
	scanning: '[[usercleaner:status.scanning]]',
	deleting: '[[usercleaner:status.deleting]]',
	completed: '[[usercleaner:status.completed]]',
	cancelled: '[[usercleaner:status.cancelled]]',
	aborted: '[[usercleaner:status.aborted]]',
	error: '[[usercleaner:status.error]]',
};

let pollTimer = null;
let lastPreview = null;
let notifiedJobId = null;
let firstRender = true;

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

	$('#dryRun').on('change', updateRunButton);
	updateRunButton();

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
		emailPattern: $('#emailPattern').val(),
		bannedMode: $('#bannedMode').val(),
		minFlags: $('#minFlags').val(),
		includeGroups: $('#includeGroups').val() || [],
		excludeGroups: $('#excludeGroups').val() || [],
		contentMode: $('#contentMode').val(),
		limit: $('#limit').val(),
	};
}

function updateRunButton() {
	const dryRun = $('#dryRun').is(':checked');
	$('#run')
		.toggleClass('btn-danger', !dryRun)
		.toggleClass('btn-warning', dryRun)
		.translateText(dryRun ? '[[usercleaner:action.run-dry]]' : '[[usercleaner:action.run-delete]]');
	$('#dry-run-box').toggleClass('border-danger border-2', !dryRun);
	$('#dry-run-help').translateText(dryRun ?
		'[[usercleaner:action.dry-run-help]]' : '[[usercleaner:action.dry-run-off-help]]');
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
				label: '[[global:cancel]]',
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
	showStarting(dryRun);
	try {
		await post('/plugins/usercleaner/job', {
			...collect(),
			dryRun,
			confirmPhrase: dryRun ? '' : 'DELETE',
			confirmCount,
		});
		notifiedJobId = null;
		alerts.success(dryRun ? '[[usercleaner:alert.dry-run-started]]' : '[[usercleaner:alert.run-started]]');
		startPolling();
	} catch (err) {
		$('#progress-card').addClass('hidden');
		$('#run, #preview').prop('disabled', false);
		showError(err);
	}
}

// The first poll is a second away; show the job as started immediately so the
// admin never sees a dead page after confirming a deletion run.
function showStarting(dryRun) {
	const suffix = dryRun ? ' [[usercleaner:status.dry-run-suffix]]' : '';
	$('#progress-card').removeClass('hidden');
	$('#progress-spinner').removeClass('hidden');
	$('#progress-title').translateText(`[[usercleaner:status.starting]]${suffix}`);
	$('#progress-meta').text('');
	$('#progress-text').text('');
	$('#progress-errors').empty();
	$('#progress-bar')
		.css('width', '100%')
		.text('')
		.removeClass('bg-danger bg-success')
		.addClass('progress-bar-animated progress-bar-striped');
	$('#run, #preview').prop('disabled', true);
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
		firstRender = false;
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
	$('#progress-spinner').toggleClass('hidden', !running);
	$('#cancel').toggleClass('hidden', !running);
	$('#run').prop('disabled', running);
	$('#preview').prop('disabled', running);

	const current = job.status === 'deleting' ? job.deleted : job.scanned;
	const target = job.status === 'deleting' ? Math.max(job.toDelete, 1) : Math.max(job.total, 1);
	const percent = Math.min(100, Math.round((current / target) * 100));

	$('#progress-bar')
		.css('width', `${running ? percent : 100}%`)
		.text(running ? `${percent}%` : '')
		.toggleClass('progress-bar-animated progress-bar-striped', running)
		.toggleClass('bg-danger', job.status === 'error' || job.status === 'aborted')
		.toggleClass('bg-success', job.status === 'completed');

	const suffix = job.dryRun ? ' [[usercleaner:status.dry-run-suffix]]' : '';
	$('#progress-title').translateText(`${STATUS_LABELS[job.status] || job.status}${suffix}`);

	const elapsed = formatDuration((job.finishedAt || Date.now()) - job.startedAt);
	$('#progress-meta').translateText(running ?
		`[[usercleaner:progress.elapsed, ${elapsed}]]` : `[[usercleaner:progress.finished, ${elapsed}]]`);

	$('#progress-text').translateText(
		`[[usercleaner:progress.text, ${job.scanned}, ${job.total}, ${job.matched}, ${job.deleted}, ${job.failed}]]`
	);

	const errors = $('#progress-errors').empty();
	if (job.message) {
		errors.append($('<div>').translateText(job.message));
	}
	job.errors.slice(0, 10).forEach(e => errors.append($('<div>').text(`uid ${e.uid}: ${e.message}`)));

	if (!running) {
		renderStats(job);
		renderSample(job.sample);
		$('#export').toggleClass('hidden', !job.hasExport);
		announceFinished(job);
		if (job.dryRun) {
			lastPreview = job;
		} else {
			// Never leave a real run armed: the next click must start from a dry run again.
			lastPreview = null;
			$('#dryRun').prop('checked', true);
			updateRunButton();
		}
	}
}

function announceFinished(job) {
	if (notifiedJobId === job.id) {
		return;
	}
	notifiedJobId = job.id;
	// A job that already ended before this page loaded is history, not news.
	if (firstRender) {
		return;
	}
	if (job.status === 'completed' && !job.dryRun) {
		alerts.success(`[[usercleaner:alert.run-finished, ${job.deleted}, ${job.failed}]]`);
	} else if (job.status === 'error' || job.status === 'aborted') {
		alerts.error(job.message || '[[usercleaner:status.aborted]]');
	}
}

function formatDuration(ms) {
	const seconds = Math.max(0, Math.round(ms / 1000));
	if (seconds < 60) {
		return `${seconds}s`;
	}
	return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatDate(timestamp) {
	const num = parseInt(timestamp, 10);
	return num > 0 ? new Date(num).toISOString().slice(0, 10) : '-';
}

function showError(err) {
	alerts.error(err.message || '[[error:invalid-data]]');
}
