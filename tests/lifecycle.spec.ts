import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SkinLifecycle } from '../src/lifecycle.ts'
import { atomicWriteJson, atomicWriteText, profilePatchFile, readDependencies, readMarketState } from '../src/profile.ts'
import type { CommandResult, PluginInstallRequest, PluginRunner } from '../src/commands.ts'
import type { LoaderEntry, Operation } from '../src/types.ts'

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'skin-lifecycle-'))
  atomicWriteJson(join(dir, 'package.json'), { dependencies: {} })
  return dir
}

async function finished(operation: Operation): Promise<Operation> {
  for (let index = 0; index < 200; index++) {
    if (operation.phase === 'done' || operation.phase === 'failed' || operation.phase === 'cancelled') return operation
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  throw new Error('operation did not finish')
}

function success(): CommandResult { return { exitCode: 0, stdout: '', stderr: '', timedOut: false } }

function firstInstallable(lifecycle: SkinLifecycle) {
  const skin = lifecycle.catalog.find(item => item.review?.installation !== 'manual-only')
  if (skin === undefined) throw new Error('fixture catalog has no installable skin')
  return skin
}

function anotherInstallable(lifecycle: SkinLifecycle, excludedId: string) {
  const skin = lifecycle.catalog.find(item => item.id !== excludedId && item.review?.installation !== 'manual-only')
  if (skin === undefined) throw new Error('fixture catalog has only one installable skin')
  return skin
}

function writeBundlePackage(dir: string, skin: { package: string; rowId: string; install: { version: string } }): void {
  const packageDir = join(dir, 'node_modules', ...skin.package.split('/'))
  mkdirSync(packageDir, { recursive: true })
  atomicWriteJson(join(packageDir, 'package.json'), { name: skin.package, version: skin.install.version, dsh: { bundle: { patch: './cordis.patch.yml' }, client: {} } })
  atomicWriteText(join(packageDir, 'cordis.patch.yml'), `- insert:\n    - id: ${skin.rowId}\n      name: ${JSON.stringify(skin.package)}\n`)
}

describe('skin lifecycle', () => {
  it('cancels a prefetch without mutating the live profile', async () => {
    const dir = fixture()
    let commandArgs: readonly string[] = []
    const runner: PluginRunner = async (_profile, args, options) => {
      commandArgs = args
      return await new Promise(resolve => {
        options?.signal?.addEventListener('abort', () => resolve({ ...success(), exitCode: null, aborted: true }), { once: true })
      })
    }
    const lifecycle = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner })
    const skin = firstInstallable(lifecycle)
    const operation = lifecycle.begin('install', skin.id)
    for (let index = 0; index < 100 && operation.phase !== 'downloading'; index++) await new Promise(resolve => setTimeout(resolve, 5))

    expect(operation).toMatchObject({ phase: 'downloading', cancelable: true })
    expect(commandArgs).toContain('--reporter=ndjson')
    lifecycle.cancel(operation.id)

    expect(await finished(operation)).toMatchObject({ phase: 'cancelled', cancelable: false, message: '操作已取消' })
    expect(readDependencies(dir)).toEqual({})
  })

  it('can replace its installable catalog without restarting the market plugin', async () => {
    const dir = fixture()
    const lifecycle = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner: async () => success() })
    const added = { ...lifecycle.catalog[0], id: 'remote.new-skin', package: 'remote-new-skin', rowId: 'remote-new-skin' }

    await lifecycle.replaceCatalog([...lifecycle.catalog, added])

    expect(lifecycle.skin(added.id)).toEqual(added)
    expect(lifecycle.states().some(state => state.skinId === added.id)).toBe(true)
  })

  it('gates market installation by installation readiness, not compatibility verification', () => {
    const dir = fixture()
    const probe = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner: async () => success() })
    const base = probe.catalog[0]
    const compatibleManual = { ...base, id: 'manual.skin', review: { compatibility: 'verified' as const, preview: 'verified' as const, installation: 'manual-only' as const } }
    const unverifiedInstallable = { ...base, id: 'installable.skin', review: { compatibility: 'unverified' as const, preview: 'verified' as const, installation: 'verified' as const } }
    const lifecycle = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner: async () => success() }, [compatibleManual, unverifiedInstallable])

    expect(() => lifecycle.begin('install', compatibleManual.id)).toThrow('尚未满足市场自动安装所需信息')
    expect(() => lifecycle.begin('install', unverifiedInstallable.id)).not.toThrow()
  })

  it('uses Desktop installPlugin for managed npm skins and blocks manual-only skins', async () => {
    const dir = fixture()
    const probe = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner: async () => success() })
    const base = probe.catalog[0]
    const managed = {
      ...base,
      id: 'desktop.managed',
      install: {
        ...base.install,
        desktop: { mode: 'managed' as const, registry: 'npm' as const, packageName: base.package, packageVersion: base.install.version },
      },
    }
    const manual = {
      ...base,
      id: 'desktop.manual',
      install: { ...base.install, desktop: { mode: 'manual-only' as const, reason: 'npm-package-not-found' } },
    }
    const calls: { run: readonly string[][]; install: PluginInstallRequest[] } = { run: [], install: [] }
    const runner: PluginRunner = Object.assign(
      async (_profile: string, args: readonly string[]) => { calls.run.push(args); return success() },
      {
        installPlugin: async (_profile: string, request: PluginInstallRequest) => {
          calls.install.push(request)
          atomicWriteJson(join(dir, 'package.json'), { dependencies: { [managed.package]: `${managed.package}@${managed.install.version}` } })
          writeBundlePackage(dir, managed)
          return success()
        },
      },
    )
    const lifecycle = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner, hostKind: 'desktop' }, [managed, manual])

    expect(() => lifecycle.begin('install', manual.id)).toThrow('Desktop 当前不支持该皮肤的一键安装')
    const operation = await finished(lifecycle.begin('install', managed.id))

    expect(operation).toMatchObject({ phase: 'done', message: 'installed; choose Use to activate' })
    expect(calls.run).toEqual([])
    expect(calls.install).toHaveLength(1)
    expect(calls.install[0]).toMatchObject({ packageName: managed.package, packageVersion: managed.install.version })
    expect(readDependencies(dir)[managed.package]).toContain(managed.install.version)
  })

  it('recovers a Desktop managed install by retrying the existing installPlugin request', async () => {
    const dir = fixture()
    const probe = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner: async () => success() })
    const base = probe.catalog[0]
    const managed = {
      ...base,
      id: 'desktop.recovery',
      install: {
        ...base.install,
        desktop: { mode: 'managed' as const, registry: 'npm' as const, packageName: base.package, packageVersion: base.install.version },
      },
    }
    const calls: PluginInstallRequest[] = []
    const runner: PluginRunner = Object.assign(
      async () => success(),
      {
        installPlugin: async (_profile: string, request: PluginInstallRequest) => {
          calls.push(request)
          return calls.length === 1
            ? { ...success(), exitCode: 1, stderr: 'published within the minimumReleaseAge cutoff' }
            : success()
        },
      },
    )
    const lifecycle = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner, hostKind: 'desktop' }, [managed])

    const operation = await finished(lifecycle.begin('install', managed.id))

    expect(operation.phase).toBe('failed')
    expect(calls).toHaveLength(2)
    expect(calls[0]?.pnpmOptions).not.toContain('--config.minimumReleaseAge=0')
    expect(calls[1]?.pnpmOptions).toContain('--config.minimumReleaseAge=0')
    expect(calls[0]?.receiptId).toBe(calls[1]?.receiptId)
  })

  it('auto-retries a new-package lockfile failure before mutating the live profile', async () => {
    const dir = fixture()
    const probe = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner: async () => success() })
    const base = probe.catalog.find(item => item.id === 'wyh66666666.dsh-transparent-ui-plugin')!
    const attempts: Array<readonly string[]> = []
    const runner: PluginRunner = async (_profile, args) => {
      attempts.push(args)
      if (args.includes('--dir')) {
        if (!args.includes('--config.minimumReleaseAge=0')) return { ...success(), exitCode: 1, stderr: 'published within the minimumReleaseAge cutoff' }
        return success()
      }
      if (args[0] === 'add') {
        atomicWriteJson(join(dir, 'package.json'), { dependencies: { [base.package]: base.install.target } })
        const packageDir = join(dir, 'node_modules', ...base.package.split('/'))
        mkdirSync(packageDir, { recursive: true })
        atomicWriteJson(join(packageDir, 'package.json'), { name: base.package, version: base.install.version, dsh: { client: { platform: 'web' } } })
      }
      return success()
    }
    const lifecycle = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner }, [base])

    const operation = await finished(lifecycle.begin('install', base.id))

    expect(operation.phase).toBe('done')
    expect(attempts[0]).not.toContain('--config.minimumReleaseAge=0')
    expect(attempts[1]).toContain('--config.minimumReleaseAge=0')
    expect(attempts.find(args => args[0] === 'add' && !args.includes('--dir'))).not.toContain('--config.minimumReleaseAge=0')
  })

  it('pre-approves the exact pnpm build key for a monorepo package', async () => {
    const dir = fixture()
    const probe = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner: async () => success() })
    const base = probe.catalog.find(item => item.id === 'wyh66666666.dsh-transparent-ui-plugin')!
    const allowBuild = '@linxin666/dsh-web-ui-all@https://codeload.github.com/springbrand-lab/dsh-skin-universe/tar.gz/29fa777bdd8c9f7d93700c56c11a96a32634d967'
    const skin = {
      ...base,
      id: 'monorepo-build.skin',
      subpath: 'packages/dsh-web-ui-all',
      install: {
        ...base.install,
        target: 'github:springbrand-lab/dsh-skin-universe#29fa777bdd8c9f7d93700c56c11a96a32634d967&path:packages/dsh-web-ui-all',
        commit: '29fa777bdd8c9f7d93700c56c11a96a32634d967',
        allowBuild,
      },
    }
    const runner: PluginRunner = async (_profile, args) => {
      if (args[0] === 'add' && !args.includes('--dir')) {
        atomicWriteJson(join(dir, 'package.json'), { dependencies: { [skin.package]: skin.install.target } })
        const packageDir = join(dir, 'node_modules', ...skin.package.split('/'))
        mkdirSync(packageDir, { recursive: true })
        atomicWriteJson(join(packageDir, 'package.json'), { name: skin.package, version: skin.install.version, dsh: { client: { platform: 'web' } } })
      }
      return success()
    }
    const lifecycle = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner }, [skin])

    expect((await finished(lifecycle.begin('install', skin.id))).phase).toBe('done')
    expect(readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf8')).toContain(`${allowBuild}#path:packages/dsh-web-ui-all`)
  })

  it('installs the curated npm source before the GitHub fallback and saves it exactly', async () => {
    const dir = fixture()
    const probe = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner: async () => success() })
    const base = firstInstallable(probe)
    const integrity = 'sha512-abc'
    const skin = {
      ...base,
      id: 'npm-priority.skin',
      install: { ...base.install, npm: { name: base.package, version: base.install.version, integrity, repository: base.repo } },
    }
    const calls: string[][] = []
    const runner: PluginRunner = async (_profile, args) => {
      calls.push([...args])
      if (args[0] === 'add' && !args.includes('--dir')) {
        atomicWriteJson(join(dir, 'package.json'), { dependencies: { [skin.package]: skin.install.version } })
        const packageDir = join(dir, 'node_modules', ...skin.package.split('/'))
        mkdirSync(packageDir, { recursive: true })
        atomicWriteJson(join(packageDir, 'package.json'), { name: skin.package, version: skin.install.version, repository: { type: 'git', url: `git+${skin.repo}.git` }, dsh: { client: { platform: 'web' } } })
        atomicWriteText(join(dir, 'pnpm-lock.yaml'), `lockfileVersion: '9.0'\npackages:\n  '${skin.package}@${skin.install.version}':\n    resolution:\n      integrity: ${integrity}\n`)
      }
      return success()
    }
    const lifecycle = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner }, [skin])

    expect((await finished(lifecycle.begin('install', skin.id))).phase).toBe('done')
    expect(calls.find(args => args[0] === 'add' && args.includes('--dir'))).toContain(`${skin.package}@${skin.install.version}`)
    expect(calls.find(args => args[0] === 'add' && !args.includes('--dir'))).toEqual(['add', `${skin.package}@${skin.install.version}`, '--prefer-offline', '--save-exact', '--reporter=ndjson'])
  })

  it('requires explicit approval for an unknown exact build key and retries with that key', async () => {
    const dir = fixture()
    const probe = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner: async () => success() })
    const base = probe.catalog.find(item => item.id === 'wyh66666666.dsh-transparent-ui-plugin')!
    const buildKey = '@example/skin@https://codeload.github.com/example/skin/tar.gz/0123456789abcdef0123456789abcdef01234567'
    const skin = { ...base, id: 'build-approval.skin', install: { ...base.install, target: 'github:example/skin#0123456789abcdef0123456789abcdef01234567', commit: '0123456789abcdef0123456789abcdef01234567', allowBuild: undefined } }
    let rejected = false
    const runner: PluginRunner = async (_profile, args) => {
      if (args.includes('--dir')) return success()
      if (args[0] === 'add' && !rejected) {
        rejected = true
        return { ...success(), exitCode: 1, stderr: `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED\n${buildKey} needs to execute build scripts but is not in allowBuilds` }
      }
      if (args[0] === 'add') {
        atomicWriteJson(join(dir, 'package.json'), { dependencies: { [skin.package]: skin.install.target } })
        const packageDir = join(dir, 'node_modules', ...skin.package.split('/'))
        mkdirSync(packageDir, { recursive: true })
        atomicWriteJson(join(packageDir, 'package.json'), { name: skin.package, version: skin.install.version, dsh: { client: { platform: 'web' } } })
      }
      return success()
    }
    const lifecycle = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner }, [skin])

    const failedOperation = await finished(lifecycle.begin('install', skin.id))
    expect(failedOperation).toMatchObject({ phase: 'failed', failure: { kind: 'build-approval', action: 'approve-build', packageName: '@example/skin' } })

    const retried = await finished(lifecycle.retry(failedOperation.id, 'approve-build'))

    expect(retried.phase).toBe('done')
    expect(readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf8')).toContain(buildKey)
  })

  it('reconciles an already installed package instead of failing the install action', async () => {
    const dir = fixture()
    const probe = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner: async () => success() })
    const skin = firstInstallable(probe)
    atomicWriteJson(join(dir, 'package.json'), { dependencies: { [skin.package]: skin.install.target } })
    writeBundlePackage(dir, skin)
    let calls = 0
    const lifecycle = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner: async () => { calls += 1; return success() } })

    const operation = await finished(lifecycle.begin('install', skin.id))
    expect(operation).toMatchObject({ phase: 'done', message: 'skin was already installed; market state reconciled' })
    expect(calls).toBe(0)
    expect(lifecycle.states().find(state => state.skinId === skin.id)?.installation).toBe('installed')
  })

  it('adopts a manually bundled skin as active and can deactivate it without uninstalling', async () => {
    const dir = fixture()
    const probe = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner: async () => success() })
    const skin = probe.catalog[0]
    atomicWriteJson(join(dir, 'package.json'), {
      dependencies: { [skin.package]: skin.install.target },
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', skin.package, 'dsh-skin-market'] } },
    })
    writeBundlePackage(dir, skin)
    const entry: LoaderEntry = {
      options: { id: skin.rowId, name: skin.package },
      fiber: {},
      update: async value => {
        entry.options.disabled = value.disabled
        entry.fiber = value.disabled ? undefined : {}
      },
    }
    const lifecycle = new SkinLifecycle({ loader: { entries: () => [entry] } }, { profile: 'test', profileDir: dir, runner: async () => success() })

    await lifecycle.replay()

    expect(readMarketState(dir).activeSkinId).toBe(skin.id)
    expect(lifecycle.states()[0]).toMatchObject({ installation: 'installed', activation: 'active' })
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { dsh: { profile: { bundles: string[] } } }
    expect(manifest.dsh.profile.bundles).toEqual(['@deepseek-ai/dsh-base', skin.package, 'dsh-skin-market'])

    expect((await finished(lifecycle.begin('deactivate', skin.id))).phase).toBe('done')
    expect(lifecycle.states().find(state => state.skinId === skin.id)).toMatchObject({ installation: 'installed', activation: 'inactive' })
    expect(readDependencies(dir)[skin.package]).toBeDefined()
  })

  it('installs inactive, activates exclusively, deactivates without removal, and uninstalls', async () => {
    const dir = fixture()
    let lifecycle!: SkinLifecycle
    const entries = new Map<string, LoaderEntry>()
    const updates: string[] = []
    const runner: PluginRunner = async (_profile, args) => {
      const skin = lifecycle.catalog.find(item => args.includes(item.install.target) || args.includes(item.package))
      if (args[0] === 'add' && skin !== undefined) {
        atomicWriteJson(join(dir, 'package.json'), { dependencies: { ...readDependencies(dir), [skin.package]: skin.install.target } })
        writeBundlePackage(dir, skin)
        entries.set(skin.rowId, { options: { id: skin.rowId, name: skin.rowId, disabled: true }, update: async function (value) { updates.push(`${skin.rowId}:${String(value.disabled)}`); this.options.disabled = value.disabled; this.fiber = value.disabled ? undefined : {} } })
      }
      if (args[0] === 'remove' && skin !== undefined) {
        const next = { ...readDependencies(dir) }
        delete next[skin.package]
        atomicWriteJson(join(dir, 'package.json'), { dependencies: next })
        entries.delete(skin.rowId)
      }
      return success()
    }
    lifecycle = new SkinLifecycle({ loader: { entries: () => entries.values() } }, { profile: 'test', profileDir: dir, runner })
    const skin = firstInstallable(lifecycle)

    const install = await finished(lifecycle.begin('install', skin.id))
    expect(install.phase).toBe('done')
    expect(lifecycle.states().find(state => state.skinId === skin.id)).toMatchObject({ installation: 'installed', activation: 'inactive' })
    expect(readMarketState(dir).activity?.[skin.id]?.installedAt).toBe(install.startedAt)
    const activation = await finished(lifecycle.begin('activate', skin.id))
    expect(activation.phase).toBe('done')
    expect(readMarketState(dir).activeSkinId).toBe(skin.id)
    expect(readMarketState(dir).activity?.[skin.id]?.usedAt).toBe(activation.startedAt)
    expect(lifecycle.states().find(state => state.skinId === skin.id)?.activation).toBe('active')

    const second = anotherInstallable(lifecycle, skin.id)
    expect((await finished(lifecycle.begin('install', second.id))).phase).toBe('done')
    updates.length = 0
    expect((await finished(lifecycle.begin('activate', second.id))).phase).toBe('done')
    expect(updates).toEqual([
      `${skin.rowId}:true`,
      `${second.rowId}:null`,
    ])
    expect((await finished(lifecycle.begin('activate', skin.id))).phase).toBe('done')
    expect((await finished(lifecycle.begin('deactivate', skin.id))).phase).toBe('done')
    expect(readDependencies(dir)[skin.package]).toBeDefined()
    expect(readMarketState(dir).activeSkinId).toBeNull()
    await lifecycle.replay()
    expect(readMarketState(dir).activeSkinId).toBeNull()
    expect((await finished(lifecycle.begin('uninstall', skin.id))).phase).toBe('done')
    expect(readDependencies(dir)[skin.package]).toBeUndefined()
  })

  it('keeps pinned skins enabled across switches and replay, then disables a secondary skin when unpinned', async () => {
    const dir = fixture()
    let lifecycle!: SkinLifecycle
    const entries = new Map<string, LoaderEntry>()
    const updates: string[] = []
    const runner: PluginRunner = async (_profile, args) => {
      const skin = lifecycle.catalog.find(item => args.includes(item.install.target) || args.includes(item.package))
      if (args[0] === 'add' && skin !== undefined) {
        atomicWriteJson(join(dir, 'package.json'), { dependencies: { ...readDependencies(dir), [skin.package]: skin.install.target } })
        writeBundlePackage(dir, skin)
        entries.set(skin.rowId, {
          options: { id: skin.rowId, name: skin.rowId, disabled: true },
          update: async function (value) {
            updates.push(`${skin.rowId}:${String(value.disabled)}`)
            this.options.disabled = value.disabled
            this.fiber = value.disabled ? undefined : {}
          },
        })
      }
      return success()
    }
    lifecycle = new SkinLifecycle({ loader: { entries: () => entries.values() } }, { profile: 'test', profileDir: dir, runner })
    const first = firstInstallable(lifecycle)
    const second = anotherInstallable(lifecycle, first.id)

    await finished(lifecycle.begin('install', first.id))
    await finished(lifecycle.begin('activate', first.id))
    await finished(lifecycle.begin('pin', first.id))
    await finished(lifecycle.begin('install', second.id))
    updates.length = 0
    await finished(lifecycle.begin('activate', second.id))

    expect(updates).toEqual([`${second.rowId}:null`])
    expect(readMarketState(dir)).toMatchObject({ activeSkinId: second.id, pinnedSkinIds: [first.id] })
    expect(lifecycle.states().find(state => state.skinId === first.id)).toMatchObject({ activation: 'active', primary: false, pinned: true })
    expect(lifecycle.states().find(state => state.skinId === second.id)).toMatchObject({ activation: 'active', primary: true, pinned: false })

    updates.length = 0
    await lifecycle.replay()
    expect(updates).toEqual([])
    await finished(lifecycle.begin('unpin', first.id))
    expect(updates).toEqual([`${first.rowId}:true`])
    expect(readMarketState(dir).pinnedSkinIds).toEqual([])
    expect(lifecycle.states().find(state => state.skinId === first.id)?.activation).toBe('inactive')
    expect(lifecycle.states().find(state => state.skinId === second.id)?.activation).toBe('active')
  })

  it('keeps the current skin enabled when its pin is removed', async () => {
    const dir = fixture()
    const probe = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner: async () => success() })
    const skin = firstInstallable(probe)
    atomicWriteJson(join(dir, 'package.json'), { dependencies: { [skin.package]: skin.install.target } })
    writeBundlePackage(dir, skin)
    const entry: LoaderEntry = {
      options: { id: skin.rowId, name: skin.rowId },
      fiber: {},
      update: async value => { entry.options.disabled = value.disabled },
    }
    const lifecycle = new SkinLifecycle({ loader: { entries: () => [entry] } }, { profile: 'test', profileDir: dir, runner: async () => success() })

    await finished(lifecycle.begin('activate', skin.id))
    await finished(lifecycle.begin('pin', skin.id))
    await finished(lifecycle.begin('unpin', skin.id))

    expect(readMarketState(dir)).toMatchObject({ activeSkinId: skin.id, pinnedSkinIds: [] })
    expect(lifecycle.states().find(state => state.skinId === skin.id)).toMatchObject({ activation: 'active', primary: true, pinned: false })
    expect(entry.options.disabled).not.toBe(true)
  })

  it('enables an installed inactive skin as pinned without replacing the current primary skin', async () => {
    const dir = fixture()
    const probe = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner: async () => success() })
    const primary = firstInstallable(probe)
    const pinned = anotherInstallable(probe, primary.id)
    atomicWriteJson(join(dir, 'package.json'), { dependencies: { [primary.package]: primary.install.target, [pinned.package]: pinned.install.target } })
    writeBundlePackage(dir, primary)
    writeBundlePackage(dir, pinned)
    const entries = [primary, pinned].map(skin => {
      const entry: LoaderEntry = {
        options: { id: skin.rowId, name: skin.rowId, disabled: true },
        update: async value => {
          entry.options.disabled = value.disabled
          entry.fiber = value.disabled ? undefined : {}
        },
      }
      return entry
    })
    const lifecycle = new SkinLifecycle({ loader: { entries: () => entries } }, { profile: 'test', profileDir: dir, runner: async () => success() })

    await finished(lifecycle.begin('activate', primary.id))
    await finished(lifecycle.begin('pin', pinned.id))

    expect(readMarketState(dir)).toMatchObject({ activeSkinId: primary.id, pinnedSkinIds: [pinned.id] })
    expect(lifecycle.states().find(state => state.skinId === primary.id)).toMatchObject({ activation: 'active', primary: true, pinned: false })
    expect(lifecycle.states().find(state => state.skinId === pinned.id)).toMatchObject({ activation: 'active', primary: false, pinned: true })
  })

  it('installs and registers a client-only skin without an upstream bundle patch', async () => {
    const dir = fixture()
    let lifecycle!: SkinLifecycle
    const runner: PluginRunner = async (_profile, args) => {
      const skin = lifecycle.catalog.find(item => args.includes(item.install.target) || args.includes(item.package))
      if (skin === undefined) return success()
      if (args[0] === 'add') {
        atomicWriteJson(join(dir, 'package.json'), { dependencies: { ...readDependencies(dir), [skin.package]: skin.install.target } })
        const packageDir = join(dir, 'node_modules', ...skin.package.split('/'))
        mkdirSync(packageDir, { recursive: true })
        atomicWriteJson(join(packageDir, 'package.json'), { name: skin.package, version: skin.install.version, dsh: { client: { platform: 'web' } } })
      }
      if (args[0] === 'remove') {
        const next = { ...readDependencies(dir) }
        delete next[skin.package]
        atomicWriteJson(join(dir, 'package.json'), { dependencies: next })
      }
      return success()
    }
    lifecycle = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner })
    const skin = lifecycle.catalog.find(item => item.id === 'wyh66666666.dsh-transparent-ui-plugin')!

    expect((await finished(lifecycle.begin('install', skin.id))).phase).toBe('done')
    expect(readFileSync(join(dir, 'cordis.patch.yml'), 'utf8')).toContain(`id: ${skin.rowId}`)
    expect(lifecycle.states().find(item => item.skinId === skin.id)?.installation).toBe('installed')
    expect((await finished(lifecycle.begin('activate', skin.id))).phase).toBe('done')
    expect(lifecycle.states().find(item => item.skinId === skin.id)?.activation).toBe('restart-required')
    expect((await finished(lifecycle.begin('uninstall', skin.id))).phase).toBe('done')
    expect(readFileSync(join(dir, 'cordis.patch.yml'), 'utf8')).not.toContain(`id: ${skin.rowId}`)
  })

  it('does not silently accept a same-name package from a different source', async () => {
    const dir = fixture()
    const probe = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner: async () => success() })
    const skin = probe.catalog.find(item => item.id === 'wyh66666666.dsh-transparent-ui-plugin')!
    atomicWriteJson(join(dir, 'package.json'), { dependencies: { [skin.package]: 'github:someone/else#0000000000000000000000000000000000000000' } })
    const packageDir = join(dir, 'node_modules', ...skin.package.split('/'))
    mkdirSync(packageDir, { recursive: true })
    atomicWriteJson(join(packageDir, 'package.json'), { name: skin.package, version: skin.install.version, dsh: { client: { platform: 'web' } } })

    const lifecycle = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner: async () => success() }, [skin])
    const operation = await finished(lifecycle.begin('install', skin.id))

    expect(operation.phase).toBe('failed')
    expect(operation.message).toContain('does not match the reviewed source/version')
  })

  it('blocks a duplicate loader before touching the live profile', async () => {
    const dir = fixture()
    const probe = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner: async () => success() })
    const skin = firstInstallable(probe)
    atomicWriteText(profilePatchFile(dir), `- insert:\n    - id: ${skin.rowId}\n      name: another-plugin\n`)
    let liveAdd = 0
    const runner: PluginRunner = async (_profile, args) => {
      if (args[0] === 'add' && !args.includes('--dir')) liveAdd += 1
      return success()
    }
    const lifecycle = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner }, [skin])

    const operation = await finished(lifecycle.begin('install', skin.id))

    expect(operation).toMatchObject({ phase: 'failed', failure: { kind: 'conflict' } })
    expect(liveAdd).toBe(0)
    expect(readDependencies(dir)).toEqual({})
  })

  it('pre-approves an exact build artifact and restores profile metadata after a failed install', async () => {
    const dir = fixture()
    const originalLockfile = 'lockfileVersion: "9.0"\n\nimporters:\n  .: {}\n'
    atomicWriteText(join(dir, 'pnpm-lock.yaml'), originalLockfile)
    let calls = 0
    const runner: PluginRunner = async (_profile, args) => {
      calls += 1
      if (calls === 1) {
        expect(args).not.toContain('--config.fetchTimeout=600000')
        expect(args).toContain('--dir')
        expect(existsSync(join(dir, 'pnpm-workspace.yaml'))).toBe(false)
        return success()
      }
      if (calls === 2) {
        expect(args).toContain('--prefer-offline')
        expect(readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf8')).toContain('dskin@https://codeload.github.com/dancingmemory/dskin/tar.gz/f24cf34bd21d23845a8b9bdaf3dbf46d01a952ed')
        atomicWriteJson(join(dir, 'package.json'), { dependencies: { ghost: 'broken' } })
        atomicWriteText(join(dir, 'pnpm-lock.yaml'), 'lockfile changed by failed add\n')
        return { ...success(), exitCode: 1, stderr: 'network failed' }
      }
      atomicWriteText(join(dir, 'pnpm-lock.yaml'), 'lockfile changed by repair install\n')
      return success()
    }
    const lifecycle = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner })
    const skin = lifecycle.catalog.find(item => item.id === 'dancingmemory.dskin')!
    const operation = await finished(lifecycle.begin('install', skin.id))
    expect(operation.phase).toBe('failed')
    expect(readDependencies(dir)).toEqual({})
    expect(existsSync(join(dir, 'pnpm-workspace.yaml'))).toBe(false)
    expect(readFileSync(join(dir, 'pnpm-lock.yaml'), 'utf8')).toBe(originalLockfile)
  })
})
