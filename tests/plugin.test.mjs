import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { apply } from '../index.js'

const SKILL_VERSION = '9900'
const REA_VERSION = '99.0.0'

/**
 * Build a tiny `rea-agents` package: a doctor command that emits fixed JSON and
 * one workflow skill. This lets the Host half run without REA or DSH.
 */
async function createFakeRea() {
  const root = await mkdtemp(join(tmpdir(), 'rea-plugin-'))
  await mkdir(join(root, 'scripts'), { recursive: true })
  await mkdir(join(root, 'skills', 'reverse-engineer-anything'), { recursive: true })

  await writeFile(
    join(root, 'package.json'),
    `${JSON.stringify({ name: 'rea-agents', version: REA_VERSION }, null, 2)}\n`,
  )

  const doctor = {
    healthy: true,
    checks: [
      { name: 'node', ok: true, classification: 'healthy', detail: process.version },
      { name: 'ghidra', ok: true, classification: 'healthy', detail: 'Ghidra ready' },
      { name: 'ghidra-platform', ok: true, classification: 'healthy', detail: 'detail row' },
      { name: 'skill:identity', ok: false, classification: 'config_drift', detail: 'stale copy' },
      { name: 'registration:dsh', ok: false, classification: 'config_drift', detail: 'stale row' },
    ],
    identity: {
      cli_package_version: REA_VERSION,
      expected_skill_version: SKILL_VERSION,
      skill: {
        installed_version: SKILL_VERSION,
        installed_tool_count: 2,
        state: 'aligned',
      },
      catalog: { counts: { mcp_tools: 2, mcp_prompts: 1, cli_commands: 3 } },
      installations: { paths: [join(homedir(), 'rea-bin')] },
    },
  }

  await writeFile(
    join(root, 'scripts', 'rea.mjs'),
    `process.stdout.write(${JSON.stringify(JSON.stringify(doctor))})\n`,
  )
  await writeFile(
    join(root, 'skills', 'reverse-engineer-anything', 'SKILL.md'),
    [
      '---',
      'name: reverse-engineer-anything',
      'description: Reverse engineer test targets with REA.',
      'metadata:',
      `  version: "${SKILL_VERSION}"`,
      '  tool_count: 2',
      '---',
      '',
      '# REA',
      '',
      'Test workflow body.',
      '',
    ].join('\n'),
  )

  return root
}

/** Apply the plugin to a mock Host context and capture its registrations. */
function createHarness() {
  const routes = []
  const providers = []
  const tools = {
    schemas() {
      return [
        { name: 'mcp__rea__binary_session', description: 'Inspect the live REA server.' },
        { name: 'mcp__rea__open_binary', description: 'Open a local target.' },
        { name: 'bash', description: 'Not an REA tool.' },
      ]
    },
  }

  const ctx = {
    inject(_names, callback) {
      callback(this)
    },
    effect(fn) {
      return fn()
    },
    on() {},
    get(name) {
      return name === 'tools' ? tools : undefined
    },
    webServer: {
      register(route) {
        routes.push(route)
        return () => {}
      },
    },
    skills: {
      registerProvider(create) {
        providers.push(create({ signal: new AbortController().signal }))
        return () => {}
      },
    },
  }

  apply(ctx)
  assert.equal(routes.length, 1)
  return { route: routes[0], providers }
}

/** Invoke the route handler with a minimal request/response pair. */
async function callRoute(handler, options = {}) {
  const { remoteAddress = '127.0.0.1', method = 'GET', url = '/plugins/rea/status?fresh=1' } = options
  let status
  let body = ''
  const headers = {}

  const response = {
    get statusCode() {
      return status
    },
    set statusCode(value) {
      status = value
    },
    setHeader(name, value) {
      headers[name.toLowerCase()] = value
    },
    end(value) {
      if (value !== undefined) body += value
    },
  }

  await handler({ method, url, socket: { remoteAddress } }, response)
  return {
    status,
    headers,
    body,
    json: body === '' ? undefined : JSON.parse(body),
  }
}

test('package metadata declares the release, compatibility, and publish settings', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

  assert.equal(manifest.name, '@axyatech/dsh-plugin-rea')
  assert.equal(manifest.version, '1.1.0')
  assert.equal(manifest.private, false)
  assert.equal(manifest.publishConfig.access, 'public')
  assert.equal(manifest.engines.dsh, '>=0.2.1-rc.3 <0.3.0-0')
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
  assert.ok(manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-sidebar'))
})

test('status route is loopback-only, redacted, and reports tools plus skill', async (t) => {
  const root = await createFakeRea()
  const saved = Object.fromEntries(
    ['REA_ROOT', 'REA_NODE', 'REA_INSTALL_ROOT'].map((key) => [key, process.env[key]]),
  )
  process.env.REA_ROOT = root
  process.env.REA_NODE = process.execPath
  process.env.REA_INSTALL_ROOT = join(root, 'install-root')

  t.after(async () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    await rm(root, { recursive: true, force: true })
  })

  const { route } = createHarness()
  assert.equal(route.kind, 'exact')
  assert.equal(route.path, '/plugins/rea/status')

  const local = await callRoute(route.handler)
  assert.equal(local.status, 200)
  assert.equal(local.json.plugin.name, '@axyatech/dsh-plugin-rea')
  assert.equal(local.json.mcp.toolCount, 2)
  assert.deepEqual(
    local.json.mcp.tools.map((tool) => tool.name),
    ['binary_session', 'open_binary'],
  )
  assert.equal(local.json.rea.version, REA_VERSION)
  assert.equal(local.json.rea.skill.version, SKILL_VERSION)
  assert.equal(local.json.rea.skill.source, 'installed')
  assert.equal(local.json.doctor.state, 'ok')
  assert.equal(local.json.doctor.identity.cliVersion, REA_VERSION)
  assert.equal(local.json.doctor.identity.expectedSkillVersion, SKILL_VERSION)
  assert.equal(local.json.doctor.identity.toolCount, 2)
  assert.ok(local.json.doctor.checks.some((check) => check.name === 'ghidra'))
  assert.equal(local.json.doctor.checks.some((check) => check.name === 'ghidra-platform'), false)
  assert.equal(local.json.doctor.checks.some((check) => check.name === 'registration:dsh'), false)
  assert.deepEqual(local.json.doctor.skillCopies, [{ name: 'identity', ok: false }])
  // `join` keeps the separator native: `~\rea-bin` on Windows, `~/rea-bin` elsewhere.
  assert.deepEqual(local.json.doctor.installations, [join('~', 'rea-bin')])
  assert.equal(local.body.includes(homedir()), false)

  const remote = await callRoute(route.handler, { remoteAddress: '203.0.113.5' })
  assert.equal(remote.status, 403)
  assert.deepEqual(remote.json, { error: 'loopback_only' })

  const post = await callRoute(route.handler, { method: 'POST' })
  assert.equal(post.status, 405)
  assert.equal(post.headers.allow, 'GET, HEAD')

  const ipv6 = await callRoute(route.handler, { remoteAddress: '::1' })
  assert.equal(ipv6.status, 200)
})

test('skill provider exposes the installed REA workflow with its directory base', async (t) => {
  const root = await createFakeRea()
  const saved = Object.fromEntries(
    ['REA_ROOT', 'REA_NODE', 'REA_INSTALL_ROOT'].map((key) => [key, process.env[key]]),
  )
  process.env.REA_ROOT = root
  process.env.REA_NODE = process.execPath
  process.env.REA_INSTALL_ROOT = join(root, 'install-root')

  t.after(async () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    await rm(root, { recursive: true, force: true })
  })

  const { providers } = createHarness()
  assert.equal(providers.length, 1)

  const provider = providers[0]
  assert.equal(provider.name, 'rea')

  const observation = await provider.list({})
  assert.equal(observation.complete, true)
  assert.equal(observation.candidates.length, 1)

  const candidate = observation.candidates[0]
  assert.equal(candidate.name, 'reverse-engineer-anything')
  assert.equal(candidate.provider, 'rea')
  assert.equal(candidate.source, 'runtime')
  assert.equal(candidate.rank, 350)
  assert.equal(candidate.resourceBase.kind, 'directory')
  assert.equal(candidate.resourceBase.path, join(root, 'skills', 'reverse-engineer-anything'))

  const skill = await provider.get(candidate, {})
  assert.equal(skill.name, 'reverse-engineer-anything')
  assert.equal(skill.metadata.version, SKILL_VERSION)
  assert.equal(skill.metadata.tool_count, '2')
  assert.match(skill.content, /^# REA/)
  assert.equal(skill.resourceBase.path, candidate.resourceBase.path)
})
