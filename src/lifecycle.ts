import { randomUUID } from 'node:crypto'
import type { PluginRunner } from './commands.ts'
import { commandError } from './commands.ts'
import { loadCatalog } from './catalog.ts'
import {
  ensureBuildAllowed,
  ensureSkinRegistration,
  pnpmWorkspaceFile,
  profilePatchFile,
  readDependencies,
  readMarketState,
  readProfileBundles,
  removeProfileBundles,
  removeSkinRegistration,
  restoreFile,
  restoreManifest,
  runtimeState,
  snapshotFile,
  snapshotManifest,
  validateInstalledSkin,
  writeMarketState,
} from './profile.ts'
import type { LoaderEntry, Operation, OperationKind, PersistedMarketState, SkinEntry, SkinRuntimeState } from './types.ts'

export interface LifecycleHost {
  loader: { entries(): Iterable<LoaderEntry> }
  on?(event: string, callback: (fiber: { entry?: { options?: { name?: string; id?: string } } }) => void): () => void
}

export interface LifecycleOptions {
  profile: string
  profileDir: string
  runner: PluginRunner
}

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error) }

export class SkinLifecycle {
  readonly operations = new Map<string, Operation>()
  private activeOperation: string | null = null
  private catalogEntries: SkinEntry[]
  private skinById: Map<string, SkinEntry>
  private disposeEvent?: () => void

  constructor(private readonly host: LifecycleHost, private readonly options: LifecycleOptions, catalog = loadCatalog().skins) {
    this.catalogEntries = catalog
    this.skinById = new Map(catalog.map(skin => [skin.id, skin]))
  }

  get catalog(): SkinEntry[] { return this.catalogEntries }

  async replaceCatalog(catalog: SkinEntry[]): Promise<void> {
    this.catalogEntries = catalog
    this.skinById = new Map(catalog.map(skin => [skin.id, skin]))
    await this.replay()
  }

  start(): void {
    void this.replay()
    this.disposeEvent = this.host.on?.('internal/plugin', fiber => {
      const name = fiber.entry?.options?.name
      const id = fiber.entry?.options?.id
      const skin = this.catalog.find(item => item.rowId === name || item.rowId === id || item.package === name)
      if (skin === undefined) return
      const state = readMarketState(this.options.profileDir)
      const shouldDisable = state.activeSkinId !== skin.id
      void this.setEntryDisabled(skin, shouldDisable)
    })
  }

  dispose(): void { this.disposeEvent?.() }

  skin(id: string): SkinEntry {
    const skin = this.skinById.get(id)
    if (skin === undefined) throw new Error('skin is not in the curated registry')
    return skin
  }

  private entriesFor(skin: SkinEntry): LoaderEntry[] {
    return [...this.host.loader.entries()].filter(entry => {
      const name = entry.options.name
      const id = entry.options.id
      return name === skin.rowId || id === skin.rowId || name === skin.package || id === skin.package
    })
  }

  private async setEntryDisabled(skin: SkinEntry, disabled: boolean): Promise<{ found: boolean; live: boolean }> {
    const entries = this.entriesFor(skin)
    for (const entry of entries) await entry.update({ disabled: disabled ? true : null }, false, true)
    return { found: entries.length > 0, live: entries.some(entry => entry.fiber !== undefined) }
  }

  async replay(): Promise<void> {
    const state = readMarketState(this.options.profileDir)
    const dependencies = readDependencies(this.options.profileDir)
    const installed = this.catalog.filter(skin => dependencies[skin.package] !== undefined)
    const rootBundles = new Set(readProfileBundles(this.options.profileDir))
    const manuallyActive = installed.filter(skin => rootBundles.has(skin.package)).at(-1)
    if (manuallyActive !== undefined) {
      state.activeSkinId = manuallyActive.id
      state.disabledSkinIds = this.catalog.filter(skin => skin.id !== manuallyActive.id).map(skin => skin.id)
      writeMarketState(this.options.profileDir, state)
    }
    // `dsh plugin add` promotes bundles to the profile root. Market-managed
    // skins must instead live in our patch rows, otherwise every installed
    // bundle is composed and multiple skins load together on the next boot.
    removeProfileBundles(this.options.profileDir, installed.map(skin => skin.package))
    for (const skin of installed) ensureSkinRegistration(this.options.profileDir, skin, state.activeSkinId !== skin.id)
    for (const skin of this.catalog) await this.setEntryDisabled(skin, true)
    const active = this.catalog.find(skin => skin.id === state.activeSkinId)
    if (active !== undefined) await this.setEntryDisabled(active, false)
  }

  states(): SkinRuntimeState[] {
    const state = readMarketState(this.options.profileDir)
    return this.catalog.map(skin => {
      const entries = this.entriesFor(skin)
      return runtimeState(this.options.profileDir, skin, state.activeSkinId, entries.some(entry => entry.fiber !== undefined), entries.length > 0)
    })
  }

  currentOperation(): Operation | null {
    return this.activeOperation === null ? null : this.operations.get(this.activeOperation) ?? null
  }

  begin(kind: OperationKind, skinId: string): Operation {
    this.skin(skinId)
    if (this.activeOperation !== null) throw new Error('another skin operation is already running')
    const operation: Operation = { id: randomUUID(), kind, skinId, phase: 'queued', startedAt: new Date().toISOString() }
    this.operations.set(operation.id, operation)
    this.activeOperation = operation.id
    void this.execute(operation)
    return operation
  }

  private update(operation: Operation, phase: Operation['phase'], message?: string): void {
    operation.phase = phase
    operation.message = message
    if (phase === 'done' || phase === 'failed') operation.finishedAt = new Date().toISOString()
  }

  private async execute(operation: Operation): Promise<void> {
    try {
      if (operation.kind === 'install') await this.install(operation)
      else if (operation.kind === 'activate') await this.activate(operation)
      else if (operation.kind === 'deactivate') await this.deactivate(operation)
      else if (operation.kind === 'update') await this.updateSkin(operation)
      else await this.uninstall(operation)
      this.update(operation, 'done', operation.message)
    } catch (error) {
      this.update(operation, 'failed', errorMessage(error))
    } finally {
      this.activeOperation = null
      const timer = setTimeout(() => this.operations.delete(operation.id), 30 * 60 * 1000)
      timer.unref?.()
    }
  }

  private async run(args: readonly string[]): Promise<void> {
    const result = await this.options.runner(this.options.profile, args)
    if (result.exitCode !== 0 || result.timedOut) throw new Error(commandError(result))
  }

  private async install(operation: Operation): Promise<void> {
    const skin = this.skin(operation.skinId)
    if (readDependencies(this.options.profileDir)[skin.package] !== undefined) {
      const validation = validateInstalledSkin(this.options.profileDir, skin)
      if (!validation.ok) throw new Error(validation.reason)
      const state = readMarketState(this.options.profileDir)
      removeProfileBundles(this.options.profileDir, [skin.package])
      ensureSkinRegistration(this.options.profileDir, skin, state.activeSkinId !== skin.id)
      if (state.activeSkinId === skin.id) state.disabledSkinIds = state.disabledSkinIds.filter(id => id !== skin.id)
      else if (!state.disabledSkinIds.includes(skin.id)) state.disabledSkinIds.push(skin.id)
      writeMarketState(this.options.profileDir, state)
      operation.message = 'skin was already installed; market state reconciled'
      return
    }
    const snapshot = snapshotManifest(this.options.profileDir)
    const patchSnapshot = snapshotFile(profilePatchFile(this.options.profileDir))
    const workspaceSnapshot = snapshotFile(pnpmWorkspaceFile(this.options.profileDir))
    this.update(operation, 'resolving')
    try {
      this.update(operation, 'downloading')
      if (skin.install.allowBuild !== undefined) ensureBuildAllowed(this.options.profileDir, skin.install.allowBuild)
      await this.run(['add', skin.install.target])
      this.update(operation, 'validating')
      const validation = validateInstalledSkin(this.options.profileDir, skin)
      if (!validation.ok) throw new Error(validation.reason)
      removeProfileBundles(this.options.profileDir, [skin.package])
      ensureSkinRegistration(this.options.profileDir, skin)
      const state = readMarketState(this.options.profileDir)
      state.activeSkinId = state.activeSkinId === skin.id ? null : state.activeSkinId
      if (!state.disabledSkinIds.includes(skin.id)) state.disabledSkinIds.push(skin.id)
      writeMarketState(this.options.profileDir, state)
      operation.message = 'installed; choose Use to activate'
    } catch (error) {
      restoreManifest(this.options.profileDir, snapshot)
      restoreFile(profilePatchFile(this.options.profileDir), patchSnapshot)
      restoreFile(pnpmWorkspaceFile(this.options.profileDir), workspaceSnapshot)
      try { await this.run(['install']) } catch { /* retain the original failure */ }
      throw error
    }
  }

  private async activate(operation: Operation): Promise<void> {
    const skin = this.skin(operation.skinId)
    if (readDependencies(this.options.profileDir)[skin.package] === undefined) throw new Error('install the skin before using it')
    this.update(operation, 'activating')
    const previous = readMarketState(this.options.profileDir)
    const next: PersistedMarketState = { version: 1, activeSkinId: skin.id, disabledSkinIds: this.catalog.filter(item => item.id !== skin.id).map(item => item.id) }
    try {
      removeProfileBundles(this.options.profileDir, [skin.package])
      ensureSkinRegistration(this.options.profileDir, skin, false)
      // Switching must be two distinct phases. Enabling the target while the
      // old skin is still disposing can leave both global style sets mounted.
      for (const item of this.catalog) await this.setEntryDisabled(item, true)
      writeMarketState(this.options.profileDir, next)
      const active = await this.setEntryDisabled(skin, false)
      operation.message = active.found && active.live ? 'skin is active' : 'activation saved; restart DSH to load this skin'
    } catch (error) {
      writeMarketState(this.options.profileDir, previous)
      await this.replay()
      throw error
    }
  }

  private async deactivate(operation: Operation): Promise<void> {
    const skin = this.skin(operation.skinId)
    this.update(operation, 'activating')
    const state = readMarketState(this.options.profileDir)
    removeProfileBundles(this.options.profileDir, [skin.package])
    ensureSkinRegistration(this.options.profileDir, skin, true)
    await this.setEntryDisabled(skin, true)
    if (state.activeSkinId === skin.id) state.activeSkinId = null
    if (!state.disabledSkinIds.includes(skin.id)) state.disabledSkinIds.push(skin.id)
    writeMarketState(this.options.profileDir, state)
    operation.message = 'DSH default appearance restored; package kept installed'
  }

  private async updateSkin(operation: Operation): Promise<void> {
    const skin = this.skin(operation.skinId)
    const wasActive = readMarketState(this.options.profileDir).activeSkinId === skin.id
    const snapshot = snapshotManifest(this.options.profileDir)
    const patchSnapshot = snapshotFile(profilePatchFile(this.options.profileDir))
    const workspaceSnapshot = snapshotFile(pnpmWorkspaceFile(this.options.profileDir))
    this.update(operation, 'resolving')
    try {
      this.update(operation, 'downloading')
      if (skin.install.allowBuild !== undefined) ensureBuildAllowed(this.options.profileDir, skin.install.allowBuild)
      await this.run(['add', skin.install.target])
      this.update(operation, 'validating')
      const validation = validateInstalledSkin(this.options.profileDir, skin)
      if (!validation.ok || validation.version !== skin.install.version) throw new Error(validation.reason ?? 'installed version did not change to the reviewed version')
      removeProfileBundles(this.options.profileDir, [skin.package])
      ensureSkinRegistration(this.options.profileDir, skin)
      if (wasActive) await this.activate(operation)
      else await this.deactivate(operation)
      operation.message = wasActive ? 'updated and kept active' : 'updated and kept inactive'
    } catch (error) {
      restoreManifest(this.options.profileDir, snapshot)
      restoreFile(profilePatchFile(this.options.profileDir), patchSnapshot)
      restoreFile(pnpmWorkspaceFile(this.options.profileDir), workspaceSnapshot)
      try { await this.run(['install']) } catch { /* retain original failure */ }
      throw error
    }
  }

  private async uninstall(operation: Operation): Promise<void> {
    const skin = this.skin(operation.skinId)
    if (readDependencies(this.options.profileDir)[skin.package] === undefined) throw new Error('skin is not installed')
    const state = readMarketState(this.options.profileDir)
    if (state.activeSkinId === skin.id) await this.deactivate(operation)
    this.update(operation, 'downloading')
    await this.run(['remove', skin.package])
    removeSkinRegistration(this.options.profileDir, skin)
    const next = readMarketState(this.options.profileDir)
    next.disabledSkinIds = next.disabledSkinIds.filter(id => id !== skin.id)
    if (next.activeSkinId === skin.id) next.activeSkinId = null
    writeMarketState(this.options.profileDir, next)
    operation.message = 'skin uninstalled'
  }
}
