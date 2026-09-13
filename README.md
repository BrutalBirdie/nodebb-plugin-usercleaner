# nodebb-plugin-usercleaner

Bulk-delete dormant, abandoned and spam accounts from a NodeBB forum, from an admin
page built around a dry-run-first workflow.

Written for forums that have accumulated tens of thousands of registrations, most of
which never posted and never came back.

## Safety model

Deleting users is irreversible, so the plugin is deliberately hard to fire by accident:

- **Dry run is on by default** and resets itself to on after every real run. A dry run
  performs the full scan and reports exactly what *would* be deleted, then stops.
- **A preview is required** before a real run can be started.
- **Two-part confirmation**: the admin must type both the exact number of matched
  accounts and the word `DELETE`.
- **The count is re-checked server-side.** The job rescans before deleting anything; if
  the number of matching accounts changed since the preview, the run aborts without
  deleting. Preview again and re-confirm.
- **Always protected, whatever the filters say**: administrators, global moderators,
  category moderators and the admin running the job.
- **Overly broad filter sets are rejected.** Post count and reputation ceilings alone are
  not enough — at least one narrowing condition (last online, account age, unconfirmed
  email, never logged in, profile signals, flags, banned state or a group) is required.
- **Per-run deletion cap** (default 1000) as a final valve.
- Every deletion is written to the ACP event log, as is the run itself.

## Filters

| Filter | Notes |
|---|---|
| Maximum post count | Default 0 — users who never posted. |
| Maximum reputation | Default 0. |
| Maximum topic count | Optional, off by default. |
| Last online longer ago than | 1m / 3m / 6m / 1y / 2y / 3y / 5y / 10y. Accounts that never logged in are compared against their registration date. |
| Account older than | Protects recent registrations from a broad rule. |
| Email never confirmed | The strongest single spam signal on a public forum. |
| Registered and never came back | `lastonline` never advanced past `joindate`. |
| Profile filled in | Full name, signature, about-me or an uploaded avatar — a profile-spammer with zero posts. |
| Banned accounts | Include / only / exclude. |
| Minimum flag count | Accounts that have been reported. |
| Group allowlist | Only consider members of these groups. |
| Group denylist | Never delete members of these groups (donators, verified members, …). |

## Content handling

Each run chooses what happens to content belonging to matched accounts:

- **Purge** (default) — `user.delete`: the account and all of its posts, topics and
  uploads are removed.
- **Keep** — `user.deleteAccount`: the account is removed, its content remains and is
  attributed to a guest.

With the default post-count filter of 0 the choice is moot, since matched users have no
content.

## Running at scale

Scanning and deleting run as a background job, because purging tens of thousands of
accounts takes far longer than an HTTP request may last. The admin page polls for live
progress and can cancel a run in flight; already-deleted accounts are not restored by a
cancellation. Deletions are paced (one account at a time, with a short pause) so a large
run does not starve the forum.

The matched account list can be downloaded as CSV after a dry run — review it before
committing to a real run.

## Install

```bash
cd /path/to/nodebb
npm install nodebb-plugin-usercleaner
./nodebb build
./nodebb restart
```

Activate under **Admin → Extend → Plugins**, then rebuild and restart once more. The page
is at **Admin → Plugins → User Cleaner**.

Access requires the `admin:users` admin privilege.

## Compatibility

NodeBB **v4.x** only. v3 and earlier are not supported: the plugin uses the v4 ACP module
loading pattern (`plugin.json` `modules` with ES-module syntax).

No theme dependency — the plugin only adds an ACP page.

## Development

```bash
cd /path/to/nodebb
npm install /path/to/nodebb-plugin-usercleaner
./nodebb build && ./nodebb dev
npm run lint   # in the plugin directory
```

## Licence

MIT
