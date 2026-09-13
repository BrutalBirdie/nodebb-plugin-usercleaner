<div class="acp-page-container usercleaner">
	<div class="row">
		<div class="col-12">
			<div class="alert alert-warning">
				<h5 class="alert-heading">[[usercleaner:intro.heading]]</h5>
				<p class="mb-0">[[usercleaner:intro.body]]</p>
			</div>
		</div>
	</div>

	<div class="row">
		<div class="col-lg-7">
			<form role="form" class="usercleaner-settings">
				<div class="card mb-3">
					<div class="card-header">[[usercleaner:filters.heading]]</div>
					<div class="card-body">
						<div class="row mb-3">
							<div class="col-sm-6">
								<label class="form-label" for="maxPostcount">[[usercleaner:filters.max-postcount]]</label>
								<input type="number" min="0" step="1" class="form-control" id="maxPostcount" name="maxPostcount" value="0" />
								<p class="form-text">[[usercleaner:filters.max-postcount-help]]</p>
							</div>
							<div class="col-sm-6">
								<label class="form-label" for="maxReputation">[[usercleaner:filters.max-reputation]]</label>
								<input type="number" min="0" step="1" class="form-control" id="maxReputation" name="maxReputation" value="0" />
								<p class="form-text">[[usercleaner:filters.max-reputation-help]]</p>
							</div>
						</div>

						<div class="row mb-3">
							<div class="col-sm-6">
								<label class="form-label" for="lastOnlinePeriod">[[usercleaner:filters.last-online]]</label>
								<select class="form-select" id="lastOnlinePeriod" name="lastOnlinePeriod">
									{{{ each lastOnlinePeriods }}}
									<option value="{./value}" {{{ if ./selected }}}selected{{{ end }}}>{./label}</option>
									{{{ end }}}
								</select>
								<p class="form-text">[[usercleaner:filters.last-online-help]]</p>
							</div>
							<div class="col-sm-6">
								<label class="form-label" for="accountAgePeriod">[[usercleaner:filters.account-age]]</label>
								<select class="form-select" id="accountAgePeriod" name="accountAgePeriod">
									{{{ each accountAgePeriods }}}
									<option value="{./value}" {{{ if ./selected }}}selected{{{ end }}}>{./label}</option>
									{{{ end }}}
								</select>
								<p class="form-text">[[usercleaner:filters.account-age-help]]</p>
							</div>
						</div>

						<hr />

						<div class="mb-3">
							<div class="form-check mb-2">
								<input type="checkbox" class="form-check-input" id="useTopiccount" name="useTopiccount" />
								<label class="form-check-label" for="useTopiccount">[[usercleaner:filters.use-topiccount]]</label>
							</div>
							<input type="number" min="0" step="1" class="form-control" id="maxTopiccount" name="maxTopiccount" value="0" />
						</div>

						<div class="form-check mb-2">
							<input type="checkbox" class="form-check-input" id="emailUnconfirmedOnly" name="emailUnconfirmedOnly" />
							<label class="form-check-label" for="emailUnconfirmedOnly">[[usercleaner:filters.email-unconfirmed]]</label>
						</div>
						<div class="form-check mb-2">
							<input type="checkbox" class="form-check-input" id="neverLoggedInOnly" name="neverLoggedInOnly" />
							<label class="form-check-label" for="neverLoggedInOnly">[[usercleaner:filters.never-logged-in]]</label>
						</div>
						<div class="form-check mb-3">
							<input type="checkbox" class="form-check-input" id="profileSpamOnly" name="profileSpamOnly" />
							<label class="form-check-label" for="profileSpamOnly">[[usercleaner:filters.profile-spam]]</label>
						</div>

						<div class="row mb-3">
							<div class="col-sm-6">
								<label class="form-label" for="bannedMode">[[usercleaner:filters.banned-mode]]</label>
								<select class="form-select" id="bannedMode" name="bannedMode">
									<option value="any">[[usercleaner:filters.banned-any]]</option>
									<option value="only">[[usercleaner:filters.banned-only]]</option>
									<option value="exclude">[[usercleaner:filters.banned-exclude]]</option>
								</select>
							</div>
							<div class="col-sm-6">
								<label class="form-label" for="minFlags">[[usercleaner:filters.min-flags]]</label>
								<input type="number" min="0" step="1" class="form-control" id="minFlags" name="minFlags" value="0" />
								<p class="form-text">[[usercleaner:filters.min-flags-help]]</p>
							</div>
						</div>

						<div class="row">
							<div class="col-sm-6">
								<label class="form-label" for="includeGroups">[[usercleaner:filters.include-groups]]</label>
								<select multiple size="6" class="form-select" id="includeGroups" name="includeGroups"></select>
								<p class="form-text">[[usercleaner:filters.include-groups-help]]</p>
							</div>
							<div class="col-sm-6">
								<label class="form-label" for="excludeGroups">[[usercleaner:filters.exclude-groups]]</label>
								<select multiple size="6" class="form-select" id="excludeGroups" name="excludeGroups"></select>
								<p class="form-text">[[usercleaner:filters.exclude-groups-help]]</p>
							</div>
						</div>
					</div>
				</div>

				<div class="card mb-3">
					<div class="card-header">[[usercleaner:deletion.heading]]</div>
					<div class="card-body">
						<div class="mb-3">
							<label class="form-label" for="contentMode">[[usercleaner:deletion.content-mode]]</label>
							<select class="form-select" id="contentMode" name="contentMode">
								<option value="purge">[[usercleaner:deletion.content-purge]]</option>
								<option value="keep">[[usercleaner:deletion.content-keep]]</option>
							</select>
							<p class="form-text">[[usercleaner:deletion.content-mode-help]]</p>
						</div>
						<div>
							<label class="form-label" for="limit">[[usercleaner:deletion.limit]]</label>
							<input type="number" min="1" step="1" class="form-control" id="limit" name="limit" value="1000" />
							<p class="form-text">[[usercleaner:deletion.limit-help]]</p>
						</div>
					</div>
				</div>
			</form>

			<div class="d-flex flex-wrap gap-2 mb-3">
				<button id="save" class="btn btn-light">[[usercleaner:action.save-defaults]]</button>
				<button id="preview" class="btn btn-primary">[[usercleaner:action.preview]]</button>
				<button id="run" class="btn btn-danger">[[usercleaner:action.run]]</button>
				<button id="cancel" class="btn btn-outline-secondary hidden">[[usercleaner:action.cancel]]</button>
			</div>

			<div class="form-check form-switch border rounded p-3 ps-5 mb-3 bg-body-tertiary">
				<input type="checkbox" class="form-check-input" id="dryRun" checked />
				<label class="form-check-label fw-bold" for="dryRun">[[usercleaner:action.dry-run]]</label>
				<p class="form-text mb-0">[[usercleaner:action.dry-run-help]]</p>
			</div>
		</div>

		<div class="col-lg-5">
			<div class="card mb-3">
				<div class="card-header">[[usercleaner:results.heading]]</div>
				<div class="card-body">
					<div id="results-empty" class="text-muted">[[usercleaner:results.empty]]</div>
					<div id="results" class="hidden">
						<dl class="row mb-2">
							<dt class="col-7">[[usercleaner:results.total]]</dt>
							<dd class="col-5 text-end" id="stat-total">0</dd>
							<dt class="col-7">[[usercleaner:results.matched]]</dt>
							<dd class="col-5 text-end fw-bold text-danger" id="stat-matched">0</dd>
							<dt class="col-7">[[usercleaner:results.to-delete]]</dt>
							<dd class="col-5 text-end" id="stat-todelete">0</dd>
							<dt class="col-7">[[usercleaner:results.protected]]</dt>
							<dd class="col-5 text-end" id="stat-protected">0</dd>
						</dl>
						<a href="#" id="export" class="btn btn-sm btn-light hidden">[[usercleaner:results.export]]</a>
					</div>
				</div>
			</div>

			<div class="card mb-3 hidden" id="progress-card">
				<div class="card-header" id="progress-title">[[usercleaner:progress.heading]]</div>
				<div class="card-body">
					<div class="progress mb-2" role="progressbar">
						<div class="progress-bar" id="progress-bar" style="width: 0%;"></div>
					</div>
					<div id="progress-text" class="small text-muted"></div>
					<div id="progress-errors" class="small text-danger mt-2"></div>
				</div>
			</div>

			<div class="card hidden" id="sample-card">
				<div class="card-header">[[usercleaner:sample.heading]]</div>
				<div class="card-body p-0" style="max-height: 420px; overflow-y: auto;">
					<table class="table table-sm table-striped mb-0">
						<thead>
							<tr>
								<th>[[usercleaner:sample.user]]</th>
								<th class="text-end">[[usercleaner:sample.posts]]</th>
								<th class="text-end">[[usercleaner:sample.rep]]</th>
								<th class="text-end">[[usercleaner:sample.last-online]]</th>
							</tr>
						</thead>
						<tbody id="sample-body"></tbody>
					</table>
				</div>
			</div>
		</div>
	</div>
</div>
