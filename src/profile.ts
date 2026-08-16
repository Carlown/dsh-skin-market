import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { parse, stringify } from 'yaml'
import type { PersistedMarketState, SkinEntry, SkinRuntimeState } from './types.ts'

export function resolveProfileDir(profile: string, explicit?: string): string {
  if (explicit !== undefined) return explicit
  const base = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh')
  return join(base, 'profiles', profile)
}

export function manifestFile(profileDir: string): string { return join(profileDir, 'package.json') }
export function profilePatchFile(profileDir: string): string { return join(profileDir, 'cordis.patch.yml') }
export function marketStateFile(profileDir: string): string { return join(profileDir, '.dsh-skin-market', 'state.json') }

export function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(readFileSync(file, 'utf8')) as T } catch { return fallback }
}

export function atomicWriteJson(file: string, value: unknown): void {
  atomicWriteText(file, `${JSON.stringify(value, null, 2)}\n`)
}

export function atomicWriteText(file: string, value: string): void {
  mkdirSync(dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.tmp`
  writeFileSync(temporary, value)
  renameSync(temporary, file)
}

export function readMarketState(profileDir: string): PersistedMarketState {
  const fallback: PersistedMarketState = { version: 1, activeSkinId: null, disabledSkinIds: [] }
  const value = readJson<PersistedMarketState>(marketStateFile(profileDir), fallback)
  if (value.version !== 1 || !Array.isArray(value.disabledSkinIds)) return fallback
  return value
}

export function writeMarketState(profileDir: string, state: PersistedMarketState): void {
  atomicWriteJson(marketStateFile(profileDir), state)
}

interface ProfileManifest { dependencies?: Record<string, string> }

export function readDependencies(profileDir: string): Record<string, string> {
  return readJson<ProfileManifest>(manifestFile(profileDir), {}).dependencies ?? {}
}

export function packageManifest(profileDir: string, packageName: string): Record<string, unknown> | null {
  const file = join(profileDir, 'node_modules', ...packageName.split('/'), 'package.json')
  if (!existsSync(file)) return null
  return readJson<Record<string, unknown> | null>(file, null)
}

export function validateInstalledSkin(profileDir: string, skin: SkinEntry): { ok: boolean; reason?: string; version?: string } {
  const manifest = packageManifest(profileDir, skin.package)
  if (manifest === null) return { ok: false, reason: 'package manifest missing' }
  const dsh = manifest.dsh as { client?: unknown } | undefined
  if (dsh?.client === undefined) return { ok: false, reason: 'dsh client manifest missing' }
  const version = typeof manifest.version === 'string' ? manifest.version : undefined
  return { ok: true, version }
}

interface PatchOperation { insert?: unknown[]; [key: string]: unknown }
interface PatchRow { id?: unknown; name?: unknown; disabled?: unknown; [key: string]: unknown }

function patchOperations(profileDir: string): PatchOperation[] {
  const file = profilePatchFile(profileDir)
  if (!existsSync(file)) return []
  const value = parse(readFileSync(file, 'utf8')) as unknown
  if (!Array.isArray(value)) throw new Error('profile cordis.patch.yml must contain a YAML sequence')
  return value as PatchOperation[]
}

function writePatchOperations(profileDir: string, operations: PatchOperation[]): void {
  atomicWriteText(profilePatchFile(profileDir), stringify(operations, { lineWidth: 0 }))
}

export function ensureSkinRegistration(profileDir: string, skin: SkinEntry, disabled = true): void {
  const operations = patchOperations(profileDir)
  let insert = operations.find(operation => Array.isArray(operation?.insert))?.insert
  if (insert === undefined) {
    insert = []
    operations.push({ insert })
  }
  const rows = insert.filter((value): value is PatchRow => typeof value === 'object' && value !== null)
  const row = rows.find(value => value.id === skin.rowId || value.name === skin.package)
  if (row !== undefined && (row.id !== skin.rowId || row.name !== skin.package)) {
    throw new Error(`loader registration conflicts with ${String(row.id ?? row.name)}`)
  }
  if (row === undefined) insert.push({ id: skin.rowId, name: skin.package, ...(disabled ? { disabled: true } : {}) })
  else if (disabled) row.disabled = true
  else delete row.disabled
  writePatchOperations(profileDir, operations)
}

export function removeSkinRegistration(profileDir: string, skin: SkinEntry): void {
  const file = profilePatchFile(profileDir)
  if (!existsSync(file)) return
  const operations = patchOperations(profileDir)
  for (const operation of operations) {
    if (!Array.isArray(operation.insert)) continue
    operation.insert = operation.insert.filter(value => {
      if (typeof value !== 'object' || value === null) return true
      const row = value as PatchRow
      return row.id !== skin.rowId || row.name !== skin.package
    })
  }
  writePatchOperations(profileDir, operations)
}

export interface FileSnapshot { existed: boolean; contents: string }

export function snapshotFile(file: string): FileSnapshot {
  return existsSync(file) ? { existed: true, contents: readFileSync(file, 'utf8') } : { existed: false, contents: '' }
}

export function restoreFile(file: string, snapshot: FileSnapshot): void {
  if (snapshot.existed) writeFileSync(file, snapshot.contents)
  else if (existsSync(file)) unlinkSync(file)
}

export function snapshotManifest(profileDir: string): FileSnapshot { return snapshotFile(manifestFile(profileDir)) }
export function restoreManifest(profileDir: string, snapshot: FileSnapshot): void { restoreFile(manifestFile(profileDir), snapshot) }

export function runtimeState(profileDir: string, skin: SkinEntry, activeSkinId: string | null, loaderLive: boolean, loaderFound: boolean): SkinRuntimeState {
  const dependencies = readDependencies(profileDir)
  const spec = dependencies[skin.package] ?? null
  if (spec === null) {
    return { skinId: skin.id, installation: 'missing', activation: 'inactive', installedVersion: null, installedSpec: null, updateAvailable: false }
  }
  const validation = validateInstalledSkin(profileDir, skin)
  if (!validation.ok) {
    return { skinId: skin.id, installation: 'broken', activation: 'inactive', installedVersion: null, installedSpec: spec, updateAvailable: false, error: validation.reason }
  }
  const active = activeSkinId === skin.id
  const activation = active ? (loaderFound ? (loaderLive ? 'active' : 'restart-required') : 'restart-required') : 'inactive'
  const updateAvailable = validation.version !== skin.install.version || !spec.includes(skin.install.commit)
  return {
    skinId: skin.id,
    installation: 'installed',
    activation,
    installedVersion: validation.version ?? null,
    installedSpec: spec,
    updateAvailable,
  }
}
