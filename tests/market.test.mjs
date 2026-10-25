import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Discover index matches the package release', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const index = JSON.parse(await readFile(new URL('../market/index.json', import.meta.url), 'utf8'))

  assert.equal(index.format, 1)
  assert.equal(typeof index.title.en, 'string')
  assert.equal(typeof index.description.en, 'string')

  const entry = index.plugins.find((plugin) => plugin.name === manifest.name)
  assert.ok(entry, 'the index lists the package')
  assert.equal(entry.icon, 'icon.svg')
  assert.equal(entry.repository.url, 'https://github.com/axyatech/rea-harness-plugin')
  assert.ok(entry.metadata.keywords.includes('reverse-engineering'))

  const release = entry.versions.find((version) => version.version === manifest.version)
  assert.ok(release, 'the index lists the current version')
  assert.match(release.source.commit, /^[0-9a-f]{40}$/)
  assert.equal(release.source.type, 'git')
  assert.equal(release.source.url, 'https://github.com/axyatech/rea-harness-plugin.git')
  assert.equal(release.engines.dsh, manifest.engines.dsh)

  const icon = await readFile(new URL('../market/icon.svg', import.meta.url), 'utf8')
  assert.match(icon, /<svg[\s>]/)
})
