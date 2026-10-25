# Changelog

All notable changes to **REA for DeepSeek Harness** are documented here.

## 1.1.0 — 2026-10-25

### Added

- Self-hosted Discover index (`market/index.json`) in the DSH plugin market
  format 1, pinned to an immutable commit.
- `engines.dsh` compatibility guard for DeepSeek Harness 0.2.x.
- Cross-platform Host test suite covering the status route, loopback guard,
  home-path redaction, doctor parsing, and the workflow skill provider.
- GitHub Actions CI on Ubuntu, macOS, and Windows with Node 22, 24, and 26.
- Sanitized panel and tool-catalog previews under `docs/assets/`, rendered from
  the self-contained pages in `docs/preview/`.
- Professional README with architecture and compatibility documentation.
- `CHANGELOG.md`.
- Tag-driven npm release workflow with provenance, a version/tag check, and a
  `prepublishOnly` test gate.
- Documented npm account, scope, and token setup for publishing.

### Changed

- Renamed the package from the taken unscoped name `dsh-plugin-rea` to
  `@axyatech/dsh-plugin-rea`; the bundle row and client module id follow.
- Marked the package publish-ready (`private: false`, public access) for the
  scoped npm name.
- Redaction now runs over the response object before serialization, so
  Windows paths are redacted correctly.
- Removed unused registration and engine-provider projections from the status
  payload.
- Documented restarting Harness after a package rename because the browser
  boot graph can cache the previous client module id.

### Security

- `/plugins/rea/status` remains read-only, loopback-only, and home-redacted.
- Added an explicit `Cross-Origin-Resource-Policy: same-origin` and
  `Referrer-Policy: no-referrer` to the status response.

## 1.0.0 — 2026-10-25

- Initial plugin: REA MCP registration, workflow skill, and sidebar panel.
