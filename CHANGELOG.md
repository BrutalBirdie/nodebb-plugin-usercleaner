# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.1] - 2026-09-14

### Changed

- Published to npm via GitHub Actions with provenance
- Excluded `eslint.config.mjs` from the npm package

## [1.0.0] - 2026-09-14

### Added

- Initial release
- Admin page to bulk-delete dormant, abandoned and spam accounts with a dry-run-first workflow
- Live filter preview, including an email filter that can match unverified addresses
- Background deletion jobs with status reporting, safe to run on clustered forums
