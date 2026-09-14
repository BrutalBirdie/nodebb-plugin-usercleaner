<div class="acp-page-container usercleaner">
	<div class="row">
		<div class="col-12">
			<div class="alert alert-warning">
				<h5 class="alert-heading">{{tx("usercleaner:intro.heading")}}</h5>
				<p class="mb-0">{{tx("usercleaner:intro.body")}}</p>
			</div>
		</div>
	</div>

	<div class="row">
		<div class="col-lg-7">
			<form role="form" class="usercleaner-settings">
				<div class="card mb-3">
					<div class="card-header">{{tx("usercleaner:filters.heading")}}</div>
					<div class="card-body">
						<div class="row mb-3">
							<div class="col-sm-6">
								<label class="form-label" for="maxPostcount">{{tx("usercleaner:filters.max-postcount")}}</label>
								<input type="number" min="0" step="1" class="form-control" id="maxPostcount" name="maxPostcount" value="0" />
								<p class="form-text">{{tx("usercleaner:filters.max-postcount-help")}}</p>
							</div>
							<div class="col-sm-6">
								<label class="form-label" for="max{{tx("usercleaner:sample.rep")}}utation">{{tx("usercleaner:filters.max-reputation")}}</label>
								<input type="number" min="0" step="1" class="form-control" id="max{{tx("usercleaner:sample.rep")}}utation" name="max{{tx("usercleaner:sample.rep")}}utation" value="0" />
								<p class="form-text">{{tx("usercleaner:filters.max-reputation-help")}}</p>
							</div>
						</div>

						<div class="row mb-3">
							<div class="col-sm-6">
								<label class="form-label" for="lastOnlinePeriod">{{tx("usercleaner:filters.last-online")}}</label>
								<select class="form-select" id="lastOnlinePeriod" name="lastOnlinePeriod">
									{{{ each lastOnlinePeriods }}}
									<option value="{./value}" {{{ if ./selected }}}selected{{{ end }}}>{{tx(./label)}}</option>
									{{{ end }}}
								</select>
								<p class="form-text">{{tx("usercleaner:filters.last-online-help")}}</p>
							</div>
							<div class="col-sm-6">
								<label class="form-label" for="accountAgePeriod">{{tx("usercleaner:filters.account-age")}}</label>
								<select class="form-select" id="accountAgePeriod" name="accountAgePeriod">
									{{{ each accountAgePeriods }}}
									<option value="{./value}" {{{ if ./selected }}}selected{{{ end }}}>{{tx(./label)}}</option>
									{{{ end }}}
								</select>
								<p class="form-text">{{tx("usercleaner:filters.account-age-help")}}</p>
							</div>
						</div>

						<hr />

						<div class="mb-3">
							<div class="form-check mb-2">
								<input type="checkbox" class="form-check-input" id="useTopiccount" name="useTopiccount" />
								<label class="form-check-label" for="useTopiccount">{{tx("usercleaner:filters.use-topiccount")}}</label>
							</div>
							<input type="number" min="0" step="1" class="form-control" id="maxTopiccount" name="maxTopiccount" value="0" />
						</div>

						<div class="form-check mb-2">
							<input type="checkbox" class="form-check-input" id="emailUnconfirmedOnly" name="emailUnconfirmedOnly" />
							<label class="form-check-label" for="emailUnconfirmedOnly">{{tx("usercleaner:filters.email-unconfirmed")}}</label>
						</div>
						<div class="form-check mb-2">
							<input type="checkbox" class="form-check-input" id="neverLoggedInOnly" name="neverLoggedInOnly" />
							<label class="form-check-label" for="neverLoggedInOnly">{{tx("usercleaner:filters.never-logged-in")}}</label>
						</div>
						<div class="form-check mb-3">
							<input type="checkbox" class="form-check-input" id="profileSpamOnly" name="profileSpamOnly" />
							<label class="form-check-label" for="profileSpamOnly">{{tx("usercleaner:filters.profile-spam")}}</label>
						</div>

						<div class="row mb-3">
							<div class="col-sm-6">
								<label class="form-label" for="bannedMode">{{tx("usercleaner:filters.banned-mode")}}</label>
								<select class="form-select" id="bannedMode" name="bannedMode">
									<option value="any">{{tx("usercleaner:filters.banned-any")}}</option>
									<option value="only">{{tx("usercleaner:filters.banned-only")}}</option>
									<option value="exclude">{{tx("usercleaner:filters.banned-exclude")}}</option>
								</select>
							</div>
							<div class="col-sm-6">
								<label class="form-label" for="minFlags">{{tx("usercleaner:filters.min-flags")}}</label>
								<input type="number" min="0" step="1" class="form-control" id="minFlags" name="minFlags" value="0" />
								<p class="form-text">{{tx("usercleaner:filters.min-flags-help")}}</p>
							</div>
						</div>

						<div class="row">
							<div class="col-sm-6">
								<label class="form-label" for="includeGroups">{{tx("usercleaner:filters.include-groups")}}</label>
								<select multiple size="6" class="form-select" id="includeGroups" name="includeGroups"></select>
								<p class="form-text">{{tx("usercleaner:filters.include-groups-help")}}</p>
							</div>
							<div class="col-sm-6">
								<label class="form-label" for="excludeGroups">{{tx("usercleaner:filters.exclude-groups")}}</label>
								<select multiple size="6" class="form-select" id="excludeGroups" name="excludeGroups"></select>
								<p class="form-text">{{tx("usercleaner:filters.exclude-groups-help")}}</p>
							</div>
						</div>
					</div>
				</div>

				<div class="card mb-3">
					<div class="card-header">{{tx("usercleaner:deletion.heading")}}</div>
					<div class="card-body">
						<div class="mb-3">
							<label class="form-label" for="contentMode">{{tx("usercleaner:deletion.content-mode")}}</label>
							<select class="form-select" id="contentMode" name="contentMode">
								<option value="purge">{{tx("usercleaner:deletion.content-purge")}}</option>
								<option value="keep">{{tx("usercleaner:deletion.content-keep")}}</option>
							</select>
							<p class="form-text">{{tx("usercleaner:deletion.content-mode-help")}}</p>
						</div>
						<div>
							<label class="form-label" for="limit">{{tx("usercleaner:deletion.limit")}}</label>
							<input type="number" min="1" step="1" class="form-control" id="limit" name="limit" value="1000" />
							<p class="form-text">{{tx("usercleaner:deletion.limit-help")}}</p>
						</div>
					</div>
				</div>
			</form>

			<div class="d-flex flex-wrap gap-2 mb-3">
				<button id="save" class="btn btn-light">{{tx("usercleaner:action.save-defaults")}}</button>
				<button id="preview" class="btn btn-primary">{{tx("usercleaner:action.preview")}}</button>
				<button id="run" class="btn btn-danger">{{tx("usercleaner:action.run")}}</button>
				<button id="cancel" class="btn btn-outline-secondary hidden">{{tx("usercleaner:action.cancel")}}</button>
			</div>

			<div class="form-check form-switch border rounded p-3 ps-5 mb-3 bg-body-tertiary">
				<input type="checkbox" class="form-check-input" id="dry{{tx("usercleaner:action.run")}}" checked />
				<label class="form-check-label fw-bold" for="dry{{tx("usercleaner:action.run")}}">{{tx("usercleaner:action.dry-run")}}</label>
				<p class="form-text mb-0">{{tx("usercleaner:action.dry-run-help")}}</p>
			</div>
		</div>

		<div class="col-lg-5">
			<div class="card mb-3">
				<div class="card-header">{{tx("usercleaner:results.heading")}}</div>
				<div class="card-body">
					<div id="results-empty" class="text-muted">{{tx("usercleaner:results.empty")}}</div>
					<div id="results" class="hidden">
						<dl class="row mb-2">
							<dt class="col-7">{{tx("usercleaner:results.total")}}</dt>
							<dd class="col-5 text-end" id="stat-total">0</dd>
							<dt class="col-7">{{tx("usercleaner:results.matched")}}</dt>
							<dd class="col-5 text-end fw-bold text-danger" id="stat-matched">0</dd>
							<dt class="col-7">{{tx("usercleaner:results.to-delete")}}</dt>
							<dd class="col-5 text-end" id="stat-todelete">0</dd>
							<dt class="col-7">{{tx("usercleaner:results.protected")}}</dt>
							<dd class="col-5 text-end" id="stat-protected">0</dd>
						</dl>
						<a href="#" id="export" class="btn btn-sm btn-light hidden">{{tx("usercleaner:results.export")}}</a>
					</div>
				</div>
			</div>

			<div class="card mb-3 hidden" id="progress-card">
				<div class="card-header" id="progress-title">{{tx("usercleaner:progress.heading")}}</div>
				<div class="card-body">
					<div class="progress mb-2" role="progressbar">
						<div class="progress-bar" id="progress-bar" style="width: 0%;"></div>
					</div>
					<div id="progress-text" class="small text-muted"></div>
					<div id="progress-errors" class="small text-danger mt-2"></div>
				</div>
			</div>

			<div class="card hidden" id="sample-card">
				<div class="card-header">{{tx("usercleaner:sample.heading")}}</div>
				<div class="card-body p-0" style="max-height: 420px; overflow-y: auto;">
					<table class="table table-sm table-striped mb-0">
						<thead>
							<tr>
								<th>{{tx("usercleaner:sample.user")}}</th>
								<th class="text-end">{{tx("usercleaner:sample.posts")}}</th>
								<th class="text-end">{{tx("usercleaner:sample.rep")}}</th>
								<th class="text-end">{{tx("usercleaner:sample.last-online")}}</th>
							</tr>
						</thead>
						<tbody id="sample-body"></tbody>
					</table>
				</div>
			</div>
		</div>
	</div>
</div>
