/**
 * REA for DeepSeek Harness — Host half.
 *
 * Two responsibilities, both optional services so the plugin stays inert in a
 * host without a web GUI or a skill registry:
 *
 *  - `GET /plugins/rea/status` returns the live REA status the sidebar panel
 *    renders: the tools the MCP client registered, the workflow skill this
 *    bundle provides, and a cached `rea doctor` audit of the local toolchain.
 *  - A skill provider contributes REA's workflow skill (`reverse-engineer-
 *    anything`) so a fresh install needs no separate `rea setup --skill` run.
 *    The skill body comes from the installed REA package when one is
 *    available, otherwise from the copy bundled with this plugin, so the
 *    instructions always match the REA release the MCP row launches.
 *
 * Everything here is local and read-only: the route only serves status, and
 * the doctor child process is chosen from fixed candidates, never from the
 * request. Environment overrides read `REA_ROOT`, `REA_LAUNCHER`, `REA_NODE`,
 * `REA_NPX` and `REA_INSTALL_ROOT`.
 */

import { spawn } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const STATUS_PATH = '/plugins/rea/status'
const DEFAULT_PACKAGE = 'rea-agents@6.8.0'
const SERVER_NAME = 'rea'
const NAMESPACE = `mcp__${SERVER_NAME}__`
const SKILL_NAME = 'reverse-engineer-anything'
const DOCTOR_TTL_MS = 45_000
const TOOLS_TTL_MS = 120_000
const DOCTOR_TIMEOUT_MS = 25_000

const PLUGIN = readOwnPackage()

/** Register the Host half: the status route and the workflow skill provider. */
export function apply(ctx) {
  const state = {
    doctor: undefined,
    doctorAt: 0,
    doctorPromise: undefined,
    tools: undefined,
    toolsAt: 0,
  }

  ctx.inject(['webServer'], (ctx) => {
    ctx.effect(
      () =>
        ctx.webServer.register({
          kind: 'exact',
          path: STATUS_PATH,
          handler: (req, res) => handleStatus(ctx, state, req, res),
        }),
      'rea: status route',
    )
  })

  ctx.inject(['skills'], (ctx) => {
    ctx.effect(
      () => ctx.skills.registerProvider((control) => createSkillProvider(control)),
      'rea: workflow skill provider',
    )
  })

  // A global provider cannot outrank a skill the agent's own composition
  // contributes from a nearer layer (for example a stale copy in
  // `~/.agents/skills`). A provider registered through the agent's own context
  // joins that layer, where rank 350 beats user roots (400/500) and still
  // yields to project roots (100/200).
  const agentProviders = new Map()
  ctx.effect(
    () => () => {
      for (const fiber of agentProviders.values()) fiber.dispose?.()
      agentProviders.clear()
    },
    'rea: agent skill providers',
  )

  ctx.on('agent/created', async ({ agent }) => {
    if (agentProviders.has(agent.id)) return
    try {
      if (agent.ctx.get('skills') === undefined) return
      const fiber = agent.ctx.inject(['skills'], (scoped) => {
        scoped.effect(
          () => scoped.skills.registerProvider((control) => createSkillProvider(control)),
          'rea: agent workflow skill provider',
        )
      })
      await fiber
      agentProviders.set(agent.id, fiber)
    } catch {
      // A skill registration must never fail agent creation.
    }
  })

  ctx.on('agent/disposed', ({ agent }) => {
    const fiber = agentProviders.get(agent.id)
    if (fiber === undefined) return
    fiber.dispose?.()
    agentProviders.delete(agent.id)
  })
}

/* ------------------------------------------------------------------ route */

async function handleStatus(ctx, state, req, res) {
  try {
    // This endpoint is a local diagnostic. Refuse anything that did not
    // originate on this machine so a LAN-bound or proxied GUI cannot leak the
    // REA install paths and tool inventory.
    if (!isLoopbackAddress(req.socket?.remoteAddress)) {
      sendJson(res, 403, { error: 'loopback_only' })
      return
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405
      res.setHeader('Allow', 'GET, HEAD')
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'method_not_allowed' }))
      return
    }
    const url = new URL(req.url ?? STATUS_PATH, 'http://127.0.0.1')
    const fresh = url.searchParams.get('fresh') === '1'
    const body = await collectStatus(ctx, state, fresh)
    sendJson(res, 200, body, req.method === 'HEAD')
  } catch (error) {
    sendJson(res, 500, { error: 'status_failed', message: messageOf(error) })
  }
}

function sendJson(res, statusCode, body, headOnly = false) {
  // The payload never needs the account's home directory: redact it once, so
  // every nested path (REA root, skill, doctor checks, launcher) is safe.
  const payload = redactHome(JSON.stringify(body))
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.end(headOnly ? undefined : payload)
}

/** True only for IPv4 loopback, IPv6 loopback, and their mapped forms. */
function isLoopbackAddress(address) {
  if (typeof address !== 'string' || address.length === 0) return false
  if (address === '::1' || address === '::ffff:7f00:1') return true
  if (address.startsWith('127.')) return true
  if (address.startsWith('::ffff:127.')) return true
  return false
}

/** Replace the current user's home prefix with `~` anywhere in a string. */
function redactHome(text) {
  const home = homedir()
  if (typeof home !== 'string' || home.length < 2) return text
  return text.split(home).join('~')
}

async function collectStatus(ctx, state, fresh) {
  const rea = resolveRea()
  const skill = inspectSkill(rea)
  const mcp = toolInventory(ctx, state, fresh)
  const doctor = await doctorReport(rea, state, fresh)

  return {
    generatedAt: new Date().toISOString(),
    plugin: { name: PLUGIN.name, version: PLUGIN.version },
    runtime: {
      platform: process.platform,
      arch: process.arch,
      node: process.versions.node,
      profile: process.env.DSH_PROFILE ?? null,
    },
    mcp,
    rea: {
      found: rea !== undefined,
      root: rea?.root ?? null,
      version: rea?.version ?? null,
      source: rea?.source ?? null,
      skill,
    },
    doctor,
  }
}

/* ------------------------------------------------------------- inventories */

function toolInventory(ctx, state, fresh) {
  const now = Date.now()
  if (!fresh && state.tools !== undefined && now - state.toolsAt < TOOLS_TTL_MS) {
    return state.tools
  }

  const tools = ctx.get('tools')
  if (tools === undefined || typeof tools.schemas !== 'function') {
    const empty = {
      available: false,
      connected: false,
      serverName: SERVER_NAME,
      namespace: NAMESPACE,
      toolCount: 0,
      tools: [],
    }
    state.tools = empty
    state.toolsAt = now
    return empty
  }

  let schemas = []
  try {
    schemas = tools.schemas()
  } catch {
    schemas = []
  }

  const entries = schemas
    .filter((schema) => typeof schema?.name === 'string' && schema.name.startsWith(NAMESPACE))
    .map((schema) => ({
      name: schema.name.slice(NAMESPACE.length),
      description: clamp(schema.description ?? '', 200),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))

  const inventory = {
    available: true,
    connected: entries.length > 0,
    serverName: SERVER_NAME,
    namespace: NAMESPACE,
    toolCount: entries.length,
    tools: entries,
  }
  state.tools = inventory
  state.toolsAt = now
  return inventory
}

/** The workflow skill this bundle contributes, described for the panel. */
function inspectSkill(rea) {
  const choice = chooseSkill(rea)
  if (choice === undefined) {
    return { found: false, name: SKILL_NAME, version: null, toolCount: null, source: null, path: null }
  }
  const parsed = parseSkillFileSync(choice.file)
  if (parsed === undefined) {
    return { found: false, name: SKILL_NAME, version: null, toolCount: null, source: choice.source, path: choice.file }
  }
  return {
    found: true,
    name: parsed.name,
    version: parsed.metadata?.version === undefined ? null : String(parsed.metadata.version),
    toolCount: numberOrNull(parsed.metadata?.tool_count),
    source: choice.source,
    path: choice.file,
  }
}

/* ------------------------------------------------------------- REA locator */

/**
 * Find the REA package that supplies the launcher and the skill body.
 * Explicit environment overrides win; otherwise the highest cached version is
 * chosen so an npx update is picked up without touching the plugin.
 */
function resolveRea() {
  const candidates = []
  const add = (root, source) => {
    if (typeof root !== 'string' || root.length === 0) return
    const absolute = resolve(expandHome(root))
    const manifest = readJson(join(absolute, 'package.json'))
    if (manifest === undefined || manifest.name !== 'rea-agents') return
    if (!existsSync(join(absolute, 'scripts', 'rea.mjs'))) return
    if (candidates.some((candidate) => candidate.root === absolute)) return
    candidates.push({ root: absolute, version: String(manifest.version ?? ''), source })
  }

  if (process.env.REA_ROOT) add(process.env.REA_ROOT, 'env')
  if (process.env.REA_LAUNCHER) {
    const launcher = resolve(expandHome(process.env.REA_LAUNCHER))
    if (basename(launcher) === 'rea.mjs') add(dirname(dirname(launcher)), 'env')
  }

  // A profile that installed rea-agents beside this plugin.
  add(join(HERE, 'node_modules', 'rea-agents'), 'bundled')
  add(join(dirname(HERE), 'rea-agents'), 'profile')

  // npm's npx cache: the launcher the MCP row uses.
  const npxCache = join(homedir(), '.npm', '_npx')
  for (const entry of readdirSafe(npxCache)) {
    add(join(npxCache, entry, 'node_modules', 'rea-agents'), 'npx-cache')
  }

  // Common global installations.
  for (const root of [
    '/opt/homebrew/lib/node_modules',
    '/usr/local/lib/node_modules',
    '/usr/lib/node_modules',
    join(homedir(), '.npm-global', 'lib', 'node_modules'),
    join(homedir(), '.volta', 'lib', 'node_modules'),
  ]) {
    add(join(root, 'rea-agents'), 'global')
  }

  if (candidates.length === 0) return undefined
  candidates.sort((left, right) => compareVersions(right.version, left.version))
  return candidates[0]
}

function chooseSkill(rea) {
  const choices = []
  if (rea !== undefined) {
    choices.push({ dir: join(rea.root, 'skills', SKILL_NAME), source: 'installed' })
  }
  choices.push({ dir: join(HERE, 'skills', SKILL_NAME), source: 'bundled' })

  // Prefer the newest instructions, so the skill matches the REA release the
  // MCP row launches even before npx has cached that release.
  let best
  for (const choice of choices) {
    const file = join(choice.dir, 'SKILL.md')
    if (!existsSync(file)) continue
    const parsed = parseSkillFileSync(file)
    const version = parsed?.metadata?.version === undefined ? null : String(parsed.metadata.version)
    const candidate = { ...choice, file, version }
    if (best === undefined || compareVersions(candidate.version ?? '0', best.version ?? '0') > 0) {
      best = candidate
    }
  }
  return best
}

/* ---------------------------------------------------------------- doctor */

async function doctorReport(rea, state, fresh) {
  const now = Date.now()
  if (!fresh && state.doctor !== undefined && now - state.doctorAt < DOCTOR_TTL_MS) {
    return { ...state.doctor, cached: true }
  }
  if (state.doctorPromise === undefined) {
    state.doctorPromise = runDoctor(rea)
      .then((report) => {
        state.doctor = report
        state.doctorAt = Date.now()
        return report
      })
      .finally(() => {
        state.doctorPromise = undefined
      })
  }
  const report = await state.doctorPromise
  return { ...report, cached: false }
}

async function runDoctor(rea) {
  const environment = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' }
  const managed = readReaEnvironment()
  if (managed !== undefined) Object.assign(environment, managed.values)

  const attempts = []
  if (rea !== undefined) {
    const script = join(rea.root, 'scripts', 'rea.mjs')
    for (const node of nodeCandidates()) {
      attempts.push({ command: node, args: [script, 'doctor', '--format', 'json'], via: `node ${script}` })
    }
  }
  attempts.push({
    command: process.env.REA_NPX ?? 'npx',
    args: ['-y', DEFAULT_PACKAGE, 'doctor', '--format', 'json'],
    via: `npx ${DEFAULT_PACKAGE}`,
    shell: process.platform === 'win32',
  })

  let lastError
  for (const attempt of attempts) {
    try {
      const parsed = await execJson(attempt.command, attempt.args, {
        env: environment,
        shell: attempt.shell === true,
      })
      return normalizeDoctor(parsed, attempt.via, managed?.source ?? 'process')
    } catch (error) {
      lastError = error
    }
  }

  return {
    state: 'error',
    healthy: false,
    via: null,
    fetchedAt: new Date().toISOString(),
    cached: false,
    envSource: managed?.source ?? 'process',
    error: lastError === undefined ? 'REA is not installed' : messageOf(lastError),
    checks: [],
    skillCopies: [],
    identity: null,
    installations: [],
  }
}

function normalizeDoctor(data, via, envSource) {
  const checks = Array.isArray(data?.checks)
    ? data.checks
    : Array.isArray(data?.scope_checks)
      ? data.scope_checks
      : []

  const skillCopies = []
  const visible = []
  const names = new Set(checks.map((check) => (typeof check?.name === 'string' ? check.name : '')).filter(Boolean))
  for (const check of checks) {
    if (typeof check?.name !== 'string') continue
    if (check.name.startsWith('registration:')) continue
    // Copies for other agents are informational here: this plugin owns the copy
    // the Harness agent loads, so the panel reports them separately.
    if (check.name.startsWith('skill:')) {
      skillCopies.push({ name: check.name.slice('skill:'.length), ok: check.ok === true })
      continue
    }
    // Provider detail checks (`ghidra-platform`, …) follow their parent check;
    // the panel shows the parent so the list stays readable.
    const separator = check.name.indexOf('-')
    if (separator > 0 && names.has(check.name.slice(0, separator))) continue
    visible.push({
      name: check.name,
      ok: check.ok === true,
      classification: typeof check.classification === 'string' ? check.classification : null,
      detail: typeof check.detail === 'string' ? clamp(check.detail, check.ok === true ? 160 : 400) : null,
      remediation: typeof check.remediation === 'string' ? clamp(check.remediation, 400) : null,
    })
  }

  const identity = data?.identity ?? null
  return {
    state: data?.healthy === false ? 'attention' : 'ok',
    healthy: data?.healthy !== false,
    via,
    fetchedAt: new Date().toISOString(),
    cached: false,
    envSource,
    error: null,
    checks: visible,
    skillCopies,
    identity:
      identity === null
        ? null
        : {
            cliVersion: nullableString(identity.cli_package_version),
            expectedSkillVersion: nullableString(identity.expected_skill_version),
            installedSkillVersion: nullableString(identity.skill?.installed_version),
            skillState: nullableString(identity.skill?.state),
            skillToolCount: numberOrNull(identity.skill?.installed_tool_count),
            toolCount: numberOrNull(identity.catalog?.counts?.mcp_tools),
            promptCount: numberOrNull(identity.catalog?.counts?.mcp_prompts),
            commandCount: numberOrNull(identity.catalog?.counts?.cli_commands),
          },
    installations: Array.isArray(identity?.installations?.paths)
      ? identity.installations.paths.filter((path) => typeof path === 'string')
      : [],
  }
}

function execJson(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: options.env ?? process.env,
      cwd: homedir(),
      windowsHide: true,
      shell: options.shell === true,
    })

    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (error, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) reject(error)
      else resolvePromise(value)
    }
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      finish(new Error(`REA doctor timed out after ${DOCTOR_TIMEOUT_MS}ms`))
    }, DOCTOR_TIMEOUT_MS)

    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
      if (stdout.length > 4_000_000) {
        child.kill('SIGKILL')
        finish(new Error('REA doctor produced too much output'))
      }
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk).slice(-4_000)
    })
    child.on('error', (error) => finish(error))
    child.on('close', (code) => {
      const json = extractJson(stdout)
      if (json === undefined) {
        finish(new Error(firstLine(stderr) ?? `REA doctor exited with code ${code}`))
        return
      }
      try {
        finish(undefined, JSON.parse(json))
      } catch {
        finish(new Error('REA doctor returned invalid JSON'))
      }
    })
  })
}

function nodeCandidates() {
  const explicit = process.env.REA_NODE
  const candidates = []
  if (typeof explicit === 'string' && explicit.length > 0) candidates.push(resolve(expandHome(explicit)))
  for (const candidate of [
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
    '/usr/bin/node',
    join(homedir(), '.volta', 'bin', 'node'),
    join(homedir(), '.local', 'bin', 'node'),
  ]) {
    if (existsSync(candidate)) candidates.push(candidate)
  }
  candidates.push('node')
  return [...new Set(candidates)]
}

/**
 * REA's installer records the analysis-engine paths it verified in
 * `environment.json`; using it keeps the panel's audit aligned with the
 * launcher for installs that never exported those variables themselves.
 */
function readReaEnvironment() {
  const root = resolve(expandHome(process.env.REA_INSTALL_ROOT ?? '~/.local/share/rea'))
  const file = join(root, 'environment.json')
  const data = readJson(file)
  if (data === undefined || typeof data !== 'object' || data === null) return undefined
  const values = {}
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && value.length > 0) values[key] = value
  }
  if (Object.keys(values).length === 0) return undefined
  return { source: 'rea-environment', values }
}

/* ----------------------------------------------------------- skill provider */

function createSkillProvider(control) {
  return {
    name: 'rea',
    async list(options) {
      const choice = chooseSkill(resolveRea())
      if (choice === undefined) return { candidates: [], complete: true }
      const parsed = await readSkill(choice.file, options?.signal)
      if (parsed === undefined) return { candidates: [], complete: true }
      return {
        candidates: [
          {
            ...summaryOf(parsed),
            provider: 'rea',
            source: 'runtime',
            rank: 350,
            locator: { file: choice.file, directory: choice.dir },
            resourceBase: { kind: 'directory', path: choice.dir },
            path: parsed.path,
          },
        ],
        complete: true,
      }
    },
    async get(candidate, options) {
      const locator = candidate?.locator
      if (typeof locator?.file !== 'string') return undefined
      const parsed = await readSkill(locator.file, options?.signal)
      if (parsed === undefined) return undefined
      return {
        ...summaryOf(parsed),
        source: candidate.source,
        provider: 'rea',
        resourceBase: {
          kind: 'directory',
          path: typeof locator.directory === 'string' ? locator.directory : dirname(locator.file),
        },
        path: parsed.path,
        ...(parsed.metadata === undefined ? {} : { metadata: parsed.metadata }),
        content: parsed.body,
      }
    },
  }
}

function summaryOf(parsed) {
  return {
    name: parsed.name,
    description: parsed.description,
    ...(parsed.whenToUse === undefined ? {} : { whenToUse: parsed.whenToUse }),
    invocation: parsed.invocation,
  }
}

async function readSkill(file, signal) {
  let raw
  try {
    raw = await readFile(file, { encoding: 'utf8', signal })
  } catch {
    return undefined
  }
  const parsed = parseFrontmatter(raw)
  if (parsed === undefined) return undefined
  const name = stringField(parsed.data, 'name')
  const description = stringField(parsed.data, 'description')
  if (name === undefined || description === undefined) return undefined
  const metadata = metadataOf(parsed.data)
  return {
    path: file,
    name,
    description,
    whenToUse: stringField(parsed.data, 'whenToUse'),
    invocation: invocationOf(parsed.data),
    ...(metadata === undefined ? {} : { metadata }),
    body: parsed.body,
  }
}

function parseSkillFileSync(file) {
  let raw
  try {
    raw = readFileSync(file, 'utf8')
  } catch {
    return undefined
  }
  const parsed = parseFrontmatter(raw)
  if (parsed === undefined) return undefined
  const name = stringField(parsed.data, 'name')
  const description = stringField(parsed.data, 'description')
  if (name === undefined || description === undefined) return undefined
  return {
    name,
    description,
    whenToUse: stringField(parsed.data, 'whenToUse'),
    invocation: invocationOf(parsed.data),
    metadata: metadataOf(parsed.data),
  }
}

/** Minimal SKILL.md frontmatter reader: flat scalars plus one nested `metadata` map. */
function parseFrontmatter(raw) {
  const text = String(raw).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  if (!text.startsWith('---\n')) return undefined
  const end = text.indexOf('\n---', 4)
  if (end === -1) return undefined
  const head = text.slice(4, end)
  const body = text.slice(end + 4).replace(/^\n/, '')

  const data = Object.create(null)
  let nested
  for (const line of head.split('\n')) {
    if (line.trim().length === 0 || line.trimStart().startsWith('#')) continue
    const match = /^(\s*)([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line)
    if (match === null) continue
    const indented = match[1].length > 0
    const key = match[2]
    const value = match[3].trim()
    if (indented && nested !== undefined) {
      if (data[nested] === undefined || typeof data[nested] !== 'object') data[nested] = Object.create(null)
      data[nested][key] = unquote(value)
      continue
    }
    if (value.length === 0) {
      nested = key
      data[key] = Object.create(null)
    } else {
      nested = undefined
      data[key] = unquote(value)
    }
  }
  return { data, body: body.trim() }
}

function metadataOf(data) {
  const metadata = data?.metadata
  if (metadata === undefined || typeof metadata !== 'object' || metadata === null) return undefined
  const entries = Object.entries(metadata)
  return entries.length === 0 ? undefined : Object.fromEntries(entries)
}

function invocationOf(data) {
  const disableModelInvocation = booleanField(data, 'disable-model-invocation')
  const userInvocable = booleanField(data, 'user-invocable')
  return {
    modelInvocable: disableModelInvocation !== true,
    userInvocable: userInvocable !== false,
  }
}

function booleanField(data, key) {
  if (!Object.hasOwn(data, key)) return undefined
  const value = data[key]
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1' || value === 'true') return true
  if (value === 0 || value === '0' || value === 'false') return false
  return undefined
}

function stringField(data, key) {
  if (!Object.hasOwn(data, key)) return undefined
  const value = data[key]
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

function unquote(value) {
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if (first === '"' && last === '"') {
      try {
        return JSON.parse(value)
      } catch {
        return value.slice(1, -1)
      }
    }
    if (first === "'" && last === "'") return value.slice(1, -1).replace(/''/g, "'")
  }
  return value
}

/* ------------------------------------------------------------------ utils */

function readOwnPackage() {
  const manifest = readJson(join(HERE, 'package.json'))
  return {
    name: typeof manifest?.name === 'string' ? manifest.name : 'dsh-plugin-rea',
    version: typeof manifest?.version === 'string' ? manifest.version : '0.0.0',
  }
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return undefined
  }
}

function readdirSafe(directory) {
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch {
    return []
  }
}

function extractJson(stdout) {
  const start = stdout.indexOf('{')
  const end = stdout.lastIndexOf('}')
  if (start === -1 || end <= start) return undefined
  return stdout.slice(start, end + 1)
}

function firstLine(text) {
  const line = String(text).trim().split('\n').find((value) => value.trim().length > 0)
  return line === undefined ? undefined : clamp(line.trim(), 300)
}

function compareVersions(left, right) {
  const parse = (value) => String(value).split(/[.+-]/).map((part) => Number.parseInt(part, 10))
  const a = parse(left)
  const b = parse(right)
  const length = Math.max(a.length, b.length)
  for (let index = 0; index < length; index += 1) {
    const x = Number.isFinite(a[index]) ? a[index] : 0
    const y = Number.isFinite(b[index]) ? b[index] : 0
    if (x !== y) return x - y
  }
  return 0
}

function expandHome(value) {
  if (typeof value !== 'string' || value.length === 0) return value
  if (value === '~') return homedir()
  if (value.startsWith('~/') || value.startsWith('~\\')) return join(homedir(), value.slice(2))
  return value
}

function nullableString(value) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function numberOrNull(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number.parseInt(value, 10)
  return null
}

function clamp(text, limit) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim()
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`
}

function messageOf(error) {
  if (error instanceof Error) return error.message
  return String(error)
}
