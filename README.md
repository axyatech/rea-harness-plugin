# REA for DeepSeek Harness

One installable DSH plugin for [REA — Reverse Engineer Anything](https://github.com/morluto/rea).
It registers REA's MCP server, supplies REA's workflow skill to the agent, and
adds a **REA** entry to the left sidebar with a live readiness panel.

No manual `cordis.patch.yml` editing, no separate skill install, and no
per-machine launcher path: the first connection downloads the pinned
`rea-agents` package through `npx` and caches it.

## What the plugin adds

| Piece | Effect |
| --- | --- |
| MCP row (`mcp-rea`) | Starts `npx -y rea-agents@6.8.0 mcp`; REA's tools appear as `mcp__rea__*`. |
| Skill provider | Contributes `reverse-engineer-anything` (REA's workflow) to the skill catalog. It registers on each agent's own layer, so it outranks a stale copy in `~/.agents/skills` while project-local skills still win. Prefers the skill inside an installed REA package, falls back to the bundled copy. |
| Host route | `GET /plugins/rea/status` returns the registered tools and a cached `rea doctor` audit. |
| Sidebar entry | A **REA** icon (below Automations) opens the panel: connection, workflow skill, analysis engines, a searchable tool catalog, example prompts, and commands. |

## Install

**From the Harness UI:** **Settings → Plugins → Add plugin**, choose the Git
repository option, and paste:

```text
https://github.com/axyatech/rea-harness-plugin.git
```

**From an agent or the `plugin_manager` tool:**

```text
plugin_manager action=install_bundle target=https://github.com/axyatech/rea-harness-plugin.git
```

**From a clone:**

```bash
git clone https://github.com/axyatech/rea-harness-plugin.git
plugin_manager action=install_bundle target=/absolute/path/to/rea-harness-plugin
```

A published npm package is not required; the Git spec installs this repository
directly. The bundle is applied on install; a page refresh loads the sidebar
entry. New sessions pick up the workflow skill. If the MCP server reports zero
tools on the first open, wait for the `npx` download and press **Refresh**.

## Privacy and security

- The plugin stores no secrets and writes nothing to disk.
- Its only endpoint is `GET /plugins/rea/status`: **read-only**,
  **loopback-only** (other peers receive `403`), and it **redacts your home
  directory to `~`** in every returned path.
- It sends no telemetry, analytics, or update checks. The only network access
  is npm's first download of the pinned REA package, plus whatever local REA
  tools you invoke.
- The repository contains no machine paths, credentials, tokens, or cookies.
  Verification screenshots are not part of this repository or the package.

Read [SECURITY.md](SECURITY.md) for the full model. This covers the plugin;
REA's own analysis tools have their own behavior and documentation.

## Requirements

- Node.js that satisfies REA's engines: `^22.23.4 || ^24.22.1 || >=26.12.1`,
  reachable as `npx` on the Harness process's `PATH`.
- Network access on the first launch (npm download). Later launches use the
  npm cache.
- Analysis engines are optional:
  - **Hopper** is detected when installed at its standard macOS location.
  - **Ghidra** needs `GHIDRA_INSTALL_DIR` (and a JDK 21+).
  - **IDA**, **JADX**, **apktool**, **ADB**, **WABT**, **TShark**, and a
    browser for web scenarios are configured through the `REA_*` variables
    documented in [REA's installation guide](https://github.com/morluto/rea/blob/main/docs/installation.md).
  - Static JavaScript/Electron, .NET, artifacts, SQLite, plist, entitlement,
    Go/Rust, and WASM analysis work without any native engine.

## Configuration

The plugin's rows can be overridden in your own `cordis.patch.yml` (a profile
patch, or the home patch at `~/.dsh/cordis.patch.yml`). A non-insert patch
replaces the **whole** `config`, so restate every field you need.

Pin another REA version or add engine paths:

```yaml
- id: mcp-rea
  name: "@deepseek-ai/dsh-mcp-client"
  config:
    serverName: rea
    transport: stdio
    command: npx
    args: ["-y", "rea-agents@6.8.0", "mcp"]
    toolCallTimeoutMs: 600000
    failOnStartupError: false
    env:
      GHIDRA_INSTALL_DIR: /absolute/path/to/ghidra_12.1.4_PUBLIC
      JAVA_HOME: /absolute/path/to/jdk-21
```

Keep personal engine paths in that local patch, never in this repository.

Environment variables read by the plugin itself:

| Variable | Purpose |
| --- | --- |
| `REA_ROOT` | Absolute path to a `rea-agents` package to use for the audit and skill. |
| `REA_LAUNCHER` | Absolute path to a `scripts/rea.mjs` launcher. |
| `REA_NODE` | Node executable for the audit (defaults to common paths, then `node`). |
| `REA_NPX` | npm launcher for the audit fallback (defaults to `npx`). |
| `REA_INSTALL_ROOT` | REA's installer state directory (default `~/.local/share/rea`); its `environment.json` supplies engine paths for the audit. |

## If you already configured REA by hand

Two MCP rows with the same `serverName` cannot both load. Remove the older
registration before enabling this bundle:

- `rea setup --client dsh` writes a `rea-mcp` row to
  `~/.dsh/cordis.patch.yml` — delete that row.
- A hand-written `mcp-rea` row in a profile patch — replace it with an
  override (see above) so it still wins over the bundle row with your engine
  paths.

## How it works

- `cordis.patch.yml` inserts the MCP client row and this package's Host row.
- `index.js` registers the status route and a `ctx.skills` provider. Both are
  optional services, so the plugin stays inactive in a host without a web
  server or skill registry. Nothing is written to disk.
- `client.js` registers `sidebar.panellist` (id `rea`) and the matching `main`
  panel. It reads only `/plugins/rea/status`.
- The panel's audit uses the same launcher family as the MCP row and merges
  REA's `environment.json` when present, so the engine list matches what REA
  itself sees.

The status route is read-only. It accepts only loopback peers, rejects every
other client with `403`, answers `GET`/`HEAD` only, and replaces the user's
home directory with `~` in all returned paths. If you reach the Harness GUI
through a reverse proxy or SSH tunnel on the same machine, the proxy's local
connection still works; direct LAN clients do not.

## Removing

```text
plugin_manager action=remove_bundle target=dsh-plugin-rea
```

Removing the bundle removes both rows and the sidebar entry. REA's own
downloads, the `npx` cache, `~/.local/share/rea`, and any `~/.agents` skill
installed by `rea setup` are untouched.

## Distributing

The repository is public and the package is marked `private` so an accidental
`npm publish` cannot claim a name. Git-based installation works as documented
above. To publish on npm:

1. Choose a unique package name in `package.json` and update the `rea-sidebar`
   row in `cordis.patch.yml` to the same name.
2. Set `"private": false`.
3. Run `npm publish` — the package has no build step and no runtime
   dependencies.
4. Users install it from **Settings → Plugins → Add** by package name.

The screenshots and the local profile patch are verification artifacts, not
package files (see `files` in `package.json`).

## Verification and known limits

- Verified on macOS (arm64) with DeepSeek Harness 0.2.1-rc.3 and REA 6.8.0 in
  the Web GUI. The Electron `file://` shell and Windows `npx` launch are not
  verified.
- The per-agent skill provider applies to agents created after the plugin
  loads. Restart Harness after installing so sessions that already exist also
  resolve the aligned copy. Project-local skills still outrank it.
- The panel reports what the Harness Host sees. The tool list comes from
  `ctx.tools.schemas()` and is cached for 2 minutes; the audit is cached for
  45 seconds. **Refresh** bypasses both.
- The audit can disagree with the MCP server when engine variables are set on
  the MCP row but not in `environment.json`. Set both, or export them before
  launching Harness.
- The plugin does not install REA's bundled workflow for *other* agents or
  create the `rea` CLI; the panel shows those commands instead.
- First launch needs network access. Offline, the MCP row fails soft
  (`failOnStartupError: false`), the panel shows **Offline**, and the reason is
  logged by the Harness MCP client.

## License

MIT (`LICENSE`). The bundled REA workflow skill is copied from `rea-agents`
6.8.0, MIT (`LICENSE-REA`); see `NOTICE`.
