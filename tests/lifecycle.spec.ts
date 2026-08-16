import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SkinLifecycle } from '../src/lifecycle.ts'
import { atomicWriteJson, readDependencies, readMarketState } from '../src/profile.ts'
import type { CommandResult, PluginRunner } from '../src/commands.ts'
import type { LoaderEntry, Operation } from '../src/types.ts'

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'skin-lifecycle-'))
  atomicWriteJson(join(dir, 'package.json'), { dependencies: {} })
  return dir
}

async function finished(operation: Operation): Promise<Operation> {
  for (let index = 0; index < 200; index++) {
    if (operation.phase === 'done' || operation.phase === 'failed') return operation
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  throw new Error('operation did not finish')
}

function success(): CommandResult { return { exitCode: 0, stdout: '', stderr: '', timedOut: false } }

describe('skin lifecycle', () => {
  it('can replace its installable catalog without restarting the market plugin', async () => {
    const dir = fixture()
    const lifecycle = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner: async () => success() })
    const added = { ...lifecycle.catalog[0], id: 'remote.new-skin', package: 'remote-new-skin', rowId: 'remote-new-skin' }

    await lifecycle.replaceCatalog([...lifecycle.catalog, added])

    expect(lifecycle.skin(added.id)).toEqual(added)
    expect(lifecycle.states().some(state => state.skinId === added.id)).toBe(true)
  })

  it('reconciles an already installed package instead of failing the install action', async () => {
    const dir = fixture()
    const probe = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner: async () => success() })
    const skin = probe.catalog[0]
    atomicWriteJson(join(dir, 'package.json'), { dependencies: { [skin.package]: skin.install.target } })
    const packageDir = join(dir, 'node_modules', ...skin.package.split('/'))
    mkdirSync(packageDir, { recursive: true })
    atomicWriteJson(join(packageDir, 'package.json'), { version: skin.install.version, dsh: { bundle: { patch: './cordis.patch.yml' }, client: {} } })
    let calls = 0
    const lifecycle = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner: async () => { calls += 1; return success() } })

    const operation = await finished(lifecycle.begin('install', skin.id))
    expect(operation).toMatchObject({ phase: 'done', message: 'skin was already installed; market state reconciled' })
    expect(calls).toBe(0)
    expect(lifecycle.states()[0].installation).toBe('installed')
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
        const packageDir = join(dir, 'node_modules', ...skin.package.split('/'))
        mkdirSync(packageDir, { recursive: true })
        atomicWriteJson(join(packageDir, 'package.json'), { version: skin.install.version, dsh: { bundle: { patch: './cordis.patch.yml' }, client: {} } })
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
    const skin = lifecycle.catalog[0]

    expect((await finished(lifecycle.begin('install', skin.id))).phase).toBe('done')
    expect(lifecycle.states()[0]).toMatchObject({ installation: 'installed', activation: 'inactive' })
    expect((await finished(lifecycle.begin('activate', skin.id))).phase).toBe('done')
    expect(readMarketState(dir).activeSkinId).toBe(skin.id)
    expect(lifecycle.states()[0].activation).toBe('active')

    const second = lifecycle.catalog[1]
    expect((await finished(lifecycle.begin('install', second.id))).phase).toBe('done')
    updates.length = 0
    expect((await finished(lifecycle.begin('activate', second.id))).phase).toBe('done')
    expect(updates).toEqual([
      `${skin.rowId}:true`,
      `${second.rowId}:true`,
      `${second.rowId}:null`,
    ])
    expect((await finished(lifecycle.begin('activate', skin.id))).phase).toBe('done')
    expect((await finished(lifecycle.begin('deactivate', skin.id))).phase).toBe('done')
    expect(readDependencies(dir)[skin.package]).toBeDefined()
    expect(readMarketState(dir).activeSkinId).toBeNull()
    expect((await finished(lifecycle.begin('uninstall', skin.id))).phase).toBe('done')
    expect(readDependencies(dir)[skin.package]).toBeUndefined()
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
        atomicWriteJson(join(packageDir, 'package.json'), { version: skin.install.version, dsh: { client: { platform: 'web' } } })
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

  it('pre-approves an exact build artifact and restores the workspace after a failed install', async () => {
    const dir = fixture()
    let calls = 0
    const runner: PluginRunner = async () => {
      calls += 1
      if (calls === 1) {
        expect(readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf8')).toContain('dskin@https://codeload.github.com/dancingmemory/dskin/tar.gz/f24cf34bd21d23845a8b9bdaf3dbf46d01a952ed')
        atomicWriteJson(join(dir, 'package.json'), { dependencies: { ghost: 'broken' } })
        return { ...success(), exitCode: 1, stderr: 'network failed' }
      }
      return success()
    }
    const lifecycle = new SkinLifecycle({ loader: { entries: () => [] } }, { profile: 'test', profileDir: dir, runner })
    const skin = lifecycle.catalog.find(item => item.id === 'dancingmemory.dskin')!
    const operation = await finished(lifecycle.begin('install', skin.id))
    expect(operation.phase).toBe('failed')
    expect(readDependencies(dir)).toEqual({})
    expect(existsSync(join(dir, 'pnpm-workspace.yaml'))).toBe(false)
  })
})
