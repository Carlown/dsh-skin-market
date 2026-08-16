import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { atomicWriteJson, atomicWriteText, ensureSkinRegistration, profilePatchFile, readMarketState, removeSkinRegistration, runtimeState, validateInstalledSkin, writeMarketState } from '../src/profile.ts'
import { loadCatalog } from '../src/catalog.ts'

function fixture() { return mkdtempSync(join(tmpdir(), 'skin-profile-')) }

describe('profile state', () => {
  it('atomically persists active and disabled skin state', () => {
    const dir = fixture()
    writeMarketState(dir, { version: 1, activeSkinId: 'a', disabledSkinIds: ['b'] })
    expect(readMarketState(dir)).toEqual({ version: 1, activeSkinId: 'a', disabledSkinIds: ['b'] })
  })

  it('detects installed, active, and update states independently', () => {
    const dir = fixture()
    const skin = loadCatalog().skins[0]
    atomicWriteJson(join(dir, 'package.json'), { dependencies: { [skin.package]: skin.install.target } })
    const packageDir = join(dir, 'node_modules', ...skin.package.split('/'))
    mkdirSync(packageDir, { recursive: true })
    atomicWriteJson(join(packageDir, 'package.json'), { version: skin.install.version, dsh: { bundle: { patch: './cordis.patch.yml' }, client: {} } })
    expect(validateInstalledSkin(dir, skin).ok).toBe(true)
    expect(runtimeState(dir, skin, skin.id, true, true)).toMatchObject({ installation: 'installed', activation: 'active', updateAvailable: false })
    expect(runtimeState(dir, skin, null, false, true)).toMatchObject({ installation: 'installed', activation: 'inactive' })
  })

  it('registers and validates a client-only skin idempotently', () => {
    const dir = fixture()
    const skin = loadCatalog().skins.find(item => item.id === 'wyh66666666.dsh-transparent-ui-plugin')!
    const packageDir = join(dir, 'node_modules', ...skin.package.split('/'))
    mkdirSync(packageDir, { recursive: true })
    atomicWriteJson(join(packageDir, 'package.json'), { version: skin.install.version, dsh: { client: { platform: 'web' } } })
    atomicWriteText(profilePatchFile(dir), '- insert:\n    - id: keep-me\n      name: existing-plugin\n')

    expect(validateInstalledSkin(dir, skin)).toMatchObject({ ok: true, version: skin.install.version })
    ensureSkinRegistration(dir, skin)
    ensureSkinRegistration(dir, skin)

    const installed = parse(readFileSync(profilePatchFile(dir), 'utf8')) as Array<{ insert?: Array<{ id: string; name: string; disabled?: boolean }> }>
    const rows = installed.flatMap(operation => operation.insert ?? [])
    expect(rows.filter(row => row.id === skin.rowId)).toEqual([{ id: skin.rowId, name: skin.package, disabled: true }])
    expect(rows.some(row => row.id === 'keep-me')).toBe(true)

    removeSkinRegistration(dir, skin)
    const removed = parse(readFileSync(profilePatchFile(dir), 'utf8')) as Array<{ insert?: Array<{ id: string }> }>
    expect(removed.flatMap(operation => operation.insert ?? []).map(row => row.id)).toEqual(['keep-me'])
  })
})
