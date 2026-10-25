# Security

## Model

REA for DeepSeek Harness is a local plugin. It runs inside your Harness
process with the same filesystem permissions as your user account. It does not
open a port of its own, install a system service, auto-update, or accept remote
control.

## Network activity

- The MCP row downloads the pinned `rea-agents@6.8.0` package from npm on first
  launch through `npx`; later launches use the npm cache.
- REA's own analysis tools can launch local programs (Hopper, Ghidra, ADB, a
  browser, and so on) when the agent calls them. That behavior belongs to REA;
  see [REA's documentation](https://github.com/morluto/rea).
- The plugin itself sends no telemetry, analytics, crash reports, or update
  checks.

## Local HTTP endpoint

`GET /plugins/rea/status` exists only to feed the sidebar panel. It is:

- **Loopback-only** — a request whose peer address is not IPv4/IPv6 loopback
  (including IPv4-mapped forms) receives `403`. A reverse proxy or SSH tunnel
  running on the same machine still works; direct LAN access does not.
- **Read-only** — `GET` and `HEAD` only, and `?fresh=1` merely bypasses the
  status caches. No request value reaches a command, path, or shell.
- **Path-redacted** — the current user's home directory is replaced with `~` in
  every returned path.
- **Free of file contents and credentials** — it returns the REA version, tool
  names/descriptions, engine readiness, and counts.

It is served by the Harness web server. If you deliberately expose the Harness
GUI itself beyond loopback, the status route remains loopback-gated.

## Secrets

- This repository contains no credentials, tokens, cookies, or private keys.
- The plugin stores no secrets. Configure REA engine paths and any credentials
  in your own Harness patch, not in this repository.
- The Harness MCP client scrubs ambient credential-like environment variables
  before merging the configured `env`.
- The status route never reads or returns environment values.

## Supply chain

- The MCP launcher is pinned to `rea-agents@6.8.0`. Review a version before
  changing the pin.
- The bundled workflow skill is copied from that release (MIT, see
  `LICENSE-REA` and `NOTICE`). The skill provider prefers the skill shipped in
  the installed REA package when it is newer.

## Reporting

Open a GitHub issue for ordinary bugs. Do not include tokens, personal paths,
or machine names. For a sensitive report, use GitHub's private vulnerability
reporting on this repository.
