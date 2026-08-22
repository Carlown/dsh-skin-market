import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { atomicWriteJson } from '../src/profile.ts'
import { discoverMonorepoTarget, npmInstallTarget, parseGithubTarget, preferredInstallTarget } from '../src/install-resolution.ts'
import { loadCatalog } from '../src/catalog.ts'

describe('install resolution', () => {
  it('prefers an exact npm source and parses immutable GitHub targets', () => {
    const base = loadCatalog().skins[0]
    const skin = {
      ...base,
      install: {
        ...base.install,
        npm: { name: base.package, version: base.install.version, integrity: 'sha512-abc', repository: base.repo },
      },
    }

    expect(npmInstallTarget(skin)).toBe(`${base.package}@${base.install.version}`)
    expect(preferredInstallTarget(skin)).toBe(`${base.package}@${base.install.version}`)
    expect(parseGithubTarget(base.install.target)).toMatchObject({ commit: base.install.commit })
  })

  it('redirects a root GitHub collection to its unique DSH child package', () => {
    const directory = mkdtempSync(join(tmpdir(), 'skin-resolution-'))
    const base = loadCatalog().skins[0]
    const commit = 'a'.repeat(40)
    const root = join(directory, 'node_modules', 'repo-root')
    mkdirSync(join(root, 'packages', 'skin'), { recursive: true })
    atomicWriteJson(join(root, 'package.json'), { name: 'repo-root', workspaces: ['packages/*'] })
    atomicWriteJson(join(root, 'packages', 'skin', 'package.json'), { name: base.package, version: base.install.version, dsh: { client: { platform: 'web' } } })

    expect(discoverMonorepoTarget(directory, base, `github:example/repo#${commit}`))
      .toBe(`github:example/repo#${commit}&path:packages/skin`)
  })

  it('rejects an ambiguous collection instead of guessing a child', () => {
    const directory = mkdtempSync(join(tmpdir(), 'skin-resolution-'))
    const base = loadCatalog().skins[0]
    const commit = 'b'.repeat(40)
    const root = join(directory, 'node_modules', 'repo-root')
    mkdirSync(join(root, 'packages', 'one'), { recursive: true })
    mkdirSync(join(root, 'packages', 'two'), { recursive: true })
    atomicWriteJson(join(root, 'package.json'), { name: 'repo-root', workspaces: ['packages/*'] })
    for (const child of ['one', 'two']) {
      atomicWriteJson(join(root, 'packages', child, 'package.json'), { name: base.package, version: base.install.version, dsh: { client: { platform: 'web' } } })
    }

    expect(() => discoverMonorepoTarget(directory, base, `github:example/repo#${commit}`)).toThrow('找到多个')
  })
})
