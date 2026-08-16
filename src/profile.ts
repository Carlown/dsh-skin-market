import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { PersistedMarketState, SkinEntry, SkinRuntimeState } from './types.ts'

export function resolveProfileDir(profile: string, explicit?: string): string {
  if (explicit !== undefined) return explicit
  const base = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh')
  return join(base, 'profiles', profile)
}

export function manifestFile(profileDir: string): string { return join(profileDir, 'package.json') }
export function marketStateFile(profileDir: string): string { return join(profileDir, '.dsh-skin-market', 'state.json') }

export function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(readFileSync(file, 'utf8')) as T } catch { return fallback }
}

export function atomicWriteJson(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.tmp`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`)
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
  const dsh = manifest.dsh as { bundle?: { patch?: unknown }; client?: unknown } | undefined
  if (typeof dsh?.bundle?.patch !== 'string' || dsh.client === undefined) return { ok: false, reason: 'dsh bundle/client manifest missing' }
  const version = typeof manifest.version === 'string' ? manifest.version : undefined
  return { ok: true, version }
}

export interface ManifestSnapshot { existed: boolean; contents: string }

export function snapshotManifest(profileDir: string): ManifestSnapshot {
  const file = manifestFile(profileDir)
  return existsSync(file) ? { existed: true, contents: readFileSync(file, 'utf8') } : { existed: false, contents: '' }
}

export function restoreManifest(profileDir: string, snapshot: ManifestSnapshot): void {
  const file = manifestFile(profileDir)
  if (!snapshot.existed) return
  writeFileSync(file, snapshot.contents)
}

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
