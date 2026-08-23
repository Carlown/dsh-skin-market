import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assessCompatibility, persistCompatibilityPatch, planCompatibilityPatch, unifiedPatch } from '../src/compatibility-adapter.ts'
import { atomicWriteJson, atomicWriteText, pnpmWorkspaceFile } from '../src/profile.ts'
import type { DshRuntime, SkinEntry } from '../src/types.ts'

function fixture(): string { return mkdtempSync(join(tmpdir(), 'skin-adapter-')) }

function skin(): SkinEntry {
  return {
    id: 'generic.skin',
    name: { zh: 'Generic', en: 'Generic' },
    author: 'test',
    description: 'test',
    repo: 'https://github.com/example/generic',
    package: '@example/generic-skin',
    rowId: 'generic-skin',
    category: 'theme',
    tags: ['theme'],
    modes: ['dark'],
    install: { target: 'github:example/generic#aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', version: '1.0.0', commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
    compatibility: {
      dsh: '^0.1.0-rc.5',
      platform: ['web'],
      adapters: [{ id: 'keyed-settings', kind: 'keyed-slot-id-to-key', when: '>=0.1.0-rc.6 <0.2.0-0', slot: 'settings.plugin.item', key: 'locale' }],
    },
    screenshots: [],
    license: { code: 'MIT', commercialUse: true },
    featuredRank: 0,
    starsSnapshot: 0,
    releaseUpdatedAt: '2026-01-01T00:00:00.000Z',
    metadataUpdatedAt: '2026-01-01T00:00:00.000Z',
    starsUpdatedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

const runtime: DshRuntime = { version: '0.1.1-rc.1', capabilities: ['slot:keyed:settings.plugin.item'], source: 'injected' }

describe('generic compatibility adapters', () => {
  it('adapts any package that uses id for a keyed settings slot', () => {
    const dir = fixture()
    const current = skin()
    const packageDir = join(dir, 'node_modules', ...current.package.split('/'))
    mkdirSync(join(packageDir, 'lib'), { recursive: true })
    atomicWriteJson(join(dir, 'package.json'), { dependencies: { [current.package]: current.install.target } })
    atomicWriteJson(join(packageDir, 'package.json'), {
      name: current.package,
      version: current.install.version,
      exports: { './client': { default: './lib/client.js' } },
      dsh: { client: { platform: 'web' } },
    })
    const source = `const NS = "settings.generic"\nctx.slots.register({\n  name: "settings.plugin.item",\n  id: "generic",\n  order: 5,\n  locale: NS,\n}, Card)`
    atomicWriteText(join(packageDir, 'lib/client.js'), source)

    expect(assessCompatibility(current, runtime)).toMatchObject({ decision: 'adaptable', adapterIds: ['keyed-settings'] })
    const plan = planCompatibilityPatch(dir, current, runtime)
    expect(plan).not.toBeNull()
    expect(plan?.patchedSource).toContain('key: "settings.generic"')
    expect(plan?.patchedSource).not.toContain('id: "generic"')

    persistCompatibilityPatch(dir, plan!)
    expect(readFileSync(plan!.patchFile, 'utf8')).toContain('-  id: "generic",')
    expect(readFileSync(plan!.patchFile, 'utf8')).toContain('+  key: "settings.generic",')
    expect(readFileSync(pnpmWorkspaceFile(dir), 'utf8')).toContain(`${current.package}@${current.install.version}`)
  })

  it('uses the built-in rule for a package without an Aqua-specific catalog adapter', () => {
    const dir = fixture()
    const current = { ...skin(), compatibility: { dsh: '^0.1.0-rc.5', platform: ['web'] } }
    const packageDir = join(dir, 'node_modules', ...current.package.split('/'))
    mkdirSync(join(packageDir, 'lib'), { recursive: true })
    atomicWriteJson(join(packageDir, 'package.json'), {
      name: current.package,
      version: current.install.version,
      exports: { './client': { default: './lib/client.js' } },
      dsh: { client: { platform: 'web' } },
    })
    atomicWriteText(join(packageDir, 'lib/client.js'), [
      'const NS = "settings.generic"',
      'ctx.slots.register({',
      '  name: "settings.plugin.item",',
      '  id: "generic",',
      '  locale: NS,',
      '}, Card)',
    ].join('\n'))

    expect(assessCompatibility(current, runtime).decision).toBe('compatible')
    const plan = planCompatibilityPatch(dir, current, runtime)
    expect(plan?.adapterIds).toEqual(['builtin-keyed-settings-plugin-item'])
    expect(plan?.patchedSource).toContain('key: "settings.generic"')
  })

  it('creates a patch only for a real source change', () => {
    expect(unifiedPatch('lib/client.js', 'const a = 1\n', 'const a = 1\n')).toBe('')
    expect(() => unifiedPatch('lib/client.js', 'a\n', 'a\nb\n')).toThrow('line count')
  })

  it('blocks an out-of-range plugin when no adapter matches', () => {
    const current = { ...skin(), compatibility: { dsh: '<0.1.0-rc.6', platform: ['web'] } }
    expect(assessCompatibility(current, runtime).decision).toBe('incompatible')
  })
})
