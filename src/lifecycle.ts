import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApprovalKeyForTarget, effectiveBuildApprovalKey } from './build-approval.ts'
import { assessCompatibility } from './compatibility.ts'
import { persistCompatibilityPatch, planCompatibilityPatch } from './compatibility-adapter.ts'
import type { PluginInstallRequest, PluginRunner } from './commands.ts'
import { loadCatalog } from './catalog.ts'
import { companionAsSkin, discoverMonorepoTarget, isNpmInstallTarget, preferredInstallTarget } from './install-resolution.ts'
import { PnpmCommandError, runPnpmWithRecovery, type PnpmFailure } from './pnpm-recovery.ts'
import {
  companionNeedsInstall,
  ensureBuildAllowed,
  ensureSkinRegistration,
  installedSpecMatches,
  cleanupCompatibilityPatchFiles,
  detachCompatibilityPatches,
  pnpmLockfile,
  pnpmWorkspaceFile,
  profilePatchFile,
  readDependencies,
  readMarketState,
  readProfileBundles,
  assertNoLoaderConflicts,
  InstallConflictError,
  compatibilityPatchFile,
  marketStateFile,
  packageManifest,
  patchedDependenciesNeedSync,
  removeSkinRegistration,
  restoreFile,
  restoreManifest,
  runtimeState,
  snapshotFile,
  validateInstalledSkin,
  writeMarketState,
  type FileSnapshot,
} from './profile.ts'
import type { DesktopInstallCapability, DshRuntime, LoaderEntry, MarketHostKind, Operation, OperationFailure, OperationKind, PersistedMarketState, SkinEntry, SkinRuntimeState } from './types.ts'

export interface LifecycleHost {
  loader: { entries(): Iterable<LoaderEntry> }
  on?(event: string, callback: (fiber: { entry?: { options?: { name?: string; id?: string } } }) => void): () => void
}

export interface LifecycleOptions {
  profile: string
  profileDir: string
  runner: PluginRunner
  hostKind?: MarketHostKind
  runtime?: DshRuntime
}

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error) }

function recoveryMessage(failure: PnpmFailure): string {
  if (failure.kind === 'release-age') return '检测到新包保护，正在临时放宽本次命令并重试'
  if (failure.kind === 'fetch-timeout') return '下载超时，正在延长 pnpm 下载等待时间并重试'
  if (failure.kind === 'network') return '检测到临时网络错误，正在自动重试'
  return failure.message
}

interface ProfileInstallSnapshot {
  manifest: FileSnapshot
  profilePatch: FileSnapshot
  workspace: FileSnapshot
  lockfile: FileSnapshot
  compatibility: FileSnapshot
}

function snapshotInstallFiles(profileDir: string, packageName: string, version: string): ProfileInstallSnapshot {
  return {
    manifest: snapshotFile(join(profileDir, 'package.json')),
    profilePatch: snapshotFile(profilePatchFile(profileDir)),
    workspace: snapshotFile(pnpmWorkspaceFile(profileDir)),
    lockfile: snapshotFile(pnpmLockfile(profileDir)),
    compatibility: snapshotFile(compatibilityPatchFile(profileDir, packageName, version)),
  }
}

function restoreProfileInstallFiles(profileDir: string, packageName: string, version: string, snapshot: ProfileInstallSnapshot): void {
  restoreManifest(profileDir, snapshot.manifest)
  restoreFile(profilePatchFile(profileDir), snapshot.profilePatch)
  restoreFile(pnpmWorkspaceFile(profileDir), snapshot.workspace)
  restoreFile(pnpmLockfile(profileDir), snapshot.lockfile)
  restoreFile(compatibilityPatchFile(profileDir, packageName, version), snapshot.compatibility)
}

export function desktopInstallError(capability: DesktopInstallCapability | undefined): string {
  if (capability?.mode === 'manual-only') {
    return `Desktop 当前不支持该皮肤的一键安装（${capability.reason}），请查看仓库安装说明`
  }
  return 'Desktop 当前仅支持已验证 npm 精确版本的一键安装，请查看仓库安装说明'
}

interface FetchProgress { size?: number; downloaded: number }

class PnpmProgressTracker {
  private buffer = ''
  private readonly fetches = new Map<string, FetchProgress>()
  private readonly unknownSizes = new Set<string>()
  private samples: Array<{ at: number; bytes: number }> = []

  push(chunk: string, operation: Operation): void {
    this.buffer += chunk
    const lines = this.buffer.split(/\r?\n/)
    this.buffer = lines.pop() ?? ''
    for (const line of lines) this.consume(line, operation)
  }

  private consume(line: string, operation: Operation): void {
    let event: Record<string, unknown>
    try { event = JSON.parse(line) as Record<string, unknown> } catch { return }
    const packageId = typeof event.packageId === 'string' ? event.packageId : undefined
    if (packageId === undefined) return
    if (event.name === 'pnpm:fetching-progress' && event.status === 'started') {
      const size = typeof event.size === 'number' && Number.isFinite(event.size) ? event.size : undefined
      this.fetches.set(packageId, { size, downloaded: 0 })
      if (size === undefined) this.unknownSizes.add(packageId)
      this.publish(operation)
      return
    }
    if (event.name === 'pnpm:fetching-progress' && event.status === 'in_progress' && typeof event.downloaded === 'number') {
      const current = this.fetches.get(packageId) ?? { downloaded: 0 }
      current.downloaded = Math.max(current.downloaded, event.downloaded)
      this.fetches.set(packageId, current)
      this.publish(operation)
      return
    }
    if (event.name === 'pnpm:progress' && event.status === 'fetched') {
      const current = this.fetches.get(packageId)
      if (current?.size !== undefined) current.downloaded = current.size
      this.publish(operation)
    }
  }

  private publish(operation: Operation): void {
    if (this.fetches.size === 0) return
    const totalKnown = this.unknownSizes.size === 0
    const total = [...this.fetches.values()].reduce((sum, item) => sum + (item.size ?? 0), 0)
    const downloaded = [...this.fetches.values()].reduce((sum, item) => sum + Math.min(item.downloaded, item.size ?? item.downloaded), 0)
    if (downloaded > 0) operation.downloadedBytes = downloaded
    else delete operation.downloadedBytes
    if (totalKnown) operation.totalBytes = total
    else delete operation.totalBytes
    const now = Date.now()
    this.samples.push({ at: now, bytes: downloaded })
    this.samples = this.samples.filter(sample => now - sample.at <= 5000)
    const first = this.samples[0]
    const last = this.samples.at(-1)
    if (first !== undefined && last !== undefined && last.at > first.at && last.bytes > first.bytes) {
      operation.bytesPerSecond = Math.round((last.bytes - first.bytes) * 1000 / (last.at - first.at))
    }
  }
}

function pinnedSkinIds(state: PersistedMarketState): string[] {
  return [...new Set((state.pinnedSkinIds ?? []).filter(id => typeof id === 'string'))]
}

function enabledSkinIds(state: PersistedMarketState): Set<string> {
  return new Set([...(state.activeSkinId === null ? [] : [state.activeSkinId]), ...pinnedSkinIds(state)])
}

function isWebClientPackage(profileDir: string, packageName: string): boolean {
  const manifest = packageManifest(profileDir, packageName)
  if (manifest === null || typeof manifest.dsh !== 'object' || manifest.dsh === null || Array.isArray(manifest.dsh)) return false
  const client = (manifest.dsh as Record<string, unknown>).client
  if (typeof client !== 'object' || client === null || Array.isArray(client)) return false
  return (client as Record<string, unknown>).platform === 'web'
}

function recordActivity(state: PersistedMarketState, skinId: string, kind: 'installedAt' | 'updatedAt' | 'usedAt', at: string): void {
  state.activity = { ...state.activity, [skinId]: { ...state.activity?.[skinId], [kind]: at } }
}

// Keep this in an .npmrc file instead of passing `--config.fetchTimeout` on
// the CLI. pnpm 11 currently leaves the dotted CLI value as a string, while
// its retry timer requires a number and throws ERR_INVALID_ARG_TYPE.
const PNPM_FETCH_CONFIG = 'fetch-timeout=600000\n'

export class SkinLifecycle {
  readonly operations = new Map<string, Operation>()
  private activeOperation: string | null = null
  private readonly abortControllers = new Map<string, AbortController>()
  private readonly pendingBuildKeys = new Map<string, string>()
  private catalogEntries: SkinEntry[]
  private skinById: Map<string, SkinEntry>
  private disposeEvent?: () => void

  constructor(private readonly host: LifecycleHost, private readonly options: LifecycleOptions, catalog = loadCatalog().skins) {
    this.catalogEntries = catalog
    this.skinById = new Map(catalog.map(skin => [skin.id, skin]))
  }

  get catalog(): SkinEntry[] { return this.catalogEntries }

  private get hostKind(): MarketHostKind { return this.options.hostKind ?? this.options.runner.hostKind ?? 'dsh' }

  private get runtime(): DshRuntime {
    return this.options.runtime ?? { version: null, capabilities: [], source: 'unknown' }
  }

  private assertRuntimeCompatibility(skin: SkinEntry): void {
    const assessment = assessCompatibility(skin, this.runtime)
    if (assessment.decision === 'incompatible') throw new Error(`当前 DSH 与 ${skin.package} 不兼容：${assessment.reason}`)
  }

  private async applyCompatibility(skin: SkinEntry, operation: Operation): Promise<void> {
    const plan = planCompatibilityPatch(this.options.profileDir, skin, this.runtime)
    if (plan === null || plan.adapterIds.length === 0) return
    persistCompatibilityPatch(this.options.profileDir, plan)
    await this.syncPnpmMetadata(operation, `正在应用兼容适配：${plan.adapterIds.join('、')}`)
  }

  private async syncPnpmMetadata(operation: Operation, message = '正在同步 pnpm 锁文件'): Promise<void> {
    if (!patchedDependenciesNeedSync(this.options.profileDir)) return
    this.update(operation, 'installing', message)
    await this.run(['install', '--no-frozen-lockfile'], operation)
    if (patchedDependenciesNeedSync(this.options.profileDir)) {
      throw new Error('pnpm patchedDependencies 未能与锁文件同步，已停止本次操作以保护 profile')
    }
  }

  private async repairMaterializedPackage(skin: SkinEntry, operation: Operation): Promise<void> {
    this.update(operation, 'installing', `正在修复已记录但未物化的皮肤依赖：${skin.package}`)
    await this.run(['install'], operation)
  }

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
      const shouldDisable = !enabledSkinIds(state).has(skin.id)
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
    for (const entry of entries) {
      // Do not rewrite an already-correct loader state during startup. The
      // DSH client module registry builds its browser boot graph while loader
      // entries are becoming live; an unnecessary disabled -> enabled cycle
      // can make an active skin disappear from that graph until the next
      // restart.
      const currentlyDisabled = entry.options.disabled === true
      if (currentlyDisabled === disabled) continue
      await entry.update({ disabled: disabled ? true : null }, false, true)
    }
    return { found: entries.length > 0, live: entries.some(entry => entry.fiber !== undefined) }
  }

  private reconcileDisabledSkinIds(state: PersistedMarketState): void {
    const enabled = enabledSkinIds(state)
    state.disabledSkinIds = this.catalog.filter(skin => !enabled.has(skin.id)).map(skin => skin.id)
  }

  private requiresRestartForTransition(previous: PersistedMarketState, next: PersistedMarketState): boolean {
    const changed = new Set([...enabledSkinIds(previous), ...enabledSkinIds(next)])
    const dependencies = readDependencies(this.options.profileDir)
    return [...changed].some(id => {
      const skin = this.skinById.get(id)
      return skin !== undefined && dependencies[skin.package] !== undefined && isWebClientPackage(this.options.profileDir, skin.package)
    })
  }

  async replay(): Promise<void> {
    const state = readMarketState(this.options.profileDir)
    const dependencies = readDependencies(this.options.profileDir)
    const installed = this.catalog.filter(skin => dependencies[skin.package] !== undefined)
    const rootBundles = new Set(readProfileBundles(this.options.profileDir))
    // A complete skin bundle remains in dsh.profile.bundles even when the
    // market manages its disabled state. Only adopt an explicitly bundled
    // skin when it has not already been marked as market-managed.
    const installedIds = new Set(installed.map(skin => skin.id))
    const normalizedPinned = pinnedSkinIds(state).filter(id => installedIds.has(id))
    const stateChanged = JSON.stringify(state.pinnedSkinIds ?? []) !== JSON.stringify(normalizedPinned)
    state.pinnedSkinIds = normalizedPinned
    const manuallyActive = state.activeSkinId === null
      ? installed.filter(skin => rootBundles.has(skin.package) && !state.disabledSkinIds.includes(skin.id) && !normalizedPinned.includes(skin.id)).at(-1)
      : undefined
    if (manuallyActive !== undefined) {
      state.activeSkinId = manuallyActive.id
    }
    const previousDisabled = JSON.stringify(state.disabledSkinIds)
    this.reconcileDisabledSkinIds(state)
    if (stateChanged || manuallyActive !== undefined || previousDisabled !== JSON.stringify(state.disabledSkinIds)) {
      writeMarketState(this.options.profileDir, state)
    }
    const enabled = enabledSkinIds(state)
    for (const skin of installed) ensureSkinRegistration(this.options.profileDir, skin, !enabled.has(skin.id))
    // On startup, preserve the active entry's initial loader state. Toggling
    // it off and back on here races the client-module registry, which builds
    // the browser boot graph while loader entries are becoming live. Only
    // reconcile installed non-active entries; the active entry's profile
    // override was already written above and should be loaded directly.
    for (const skin of installed) {
      await this.setEntryDisabled(skin, !enabled.has(skin.id))
    }
  }

  states(): SkinRuntimeState[] {
    const state = readMarketState(this.options.profileDir)
    return this.catalog.map(skin => {
      const entries = this.entriesFor(skin)
      return runtimeState(this.options.profileDir, skin, state.activeSkinId, entries.some(entry => entry.fiber !== undefined), entries.length > 0, pinnedSkinIds(state), state.activity?.[skin.id])
    })
  }

  currentOperation(): Operation | null {
    return this.activeOperation === null ? null : this.operations.get(this.activeOperation) ?? null
  }

  begin(kind: OperationKind, skinId: string, approvedBuildKey?: string): Operation {
    const skin = this.skin(skinId)
    if (kind === 'install' || kind === 'update') {
      if (this.hostKind === 'desktop' && skin.install.desktop?.mode !== 'managed') {
        throw new Error(desktopInstallError(skin.install.desktop))
      }
      if (this.hostKind !== 'desktop' && skin.review?.installation === 'manual-only') {
        throw new Error('该皮肤尚未满足市场自动安装所需信息，请查看仓库安装说明')
      }
    }
    if (this.activeOperation !== null) throw new Error('another skin operation is already running')
    const operation: Operation = {
      id: randomUUID(), kind, skinId, phase: 'queued', startedAt: new Date().toISOString(),
      cancelable: kind === 'install' || kind === 'update',
    }
    this.operations.set(operation.id, operation)
    this.abortControllers.set(operation.id, new AbortController())
    if (approvedBuildKey !== undefined) this.pendingBuildKeys.set(operation.id, approvedBuildKey)
    this.activeOperation = operation.id
    void this.execute(operation)
    return operation
  }

  retry(id: string, action: 'retry' | 'approve-build'): Operation {
    const failed = this.operations.get(id)
    if (failed === undefined || failed.phase !== 'failed') throw new Error('operation is not retryable')
    if (failed.failure?.action !== action) throw new Error('该操作不支持此恢复动作')
    const approvedBuildKey = action === 'approve-build' ? this.pendingBuildKeys.get(id) : undefined
    if (action === 'approve-build' && approvedBuildKey === undefined) throw new Error('未找到需要批准的精确构建项')
    return this.begin(failed.kind, failed.skinId, approvedBuildKey)
  }

  private update(operation: Operation, phase: Operation['phase'], message?: string): void {
    operation.phase = phase
    operation.message = message
    operation.cancelable = (operation.kind === 'install' || operation.kind === 'update')
      && (phase === 'queued' || phase === 'resolving' || phase === 'downloading')
    if (phase === 'done' || phase === 'failed' || phase === 'cancelled') operation.finishedAt = new Date().toISOString()
  }

  cancel(id: string): Operation {
    const operation = this.operations.get(id)
    if (operation === undefined) throw new Error('operation not found')
    if (operation.phase === 'done' || operation.phase === 'failed' || operation.phase === 'cancelled') return operation
    if (operation.cancelable !== true) throw new Error('当前阶段无法安全取消，请等待操作完成')
    this.update(operation, 'cancelling', '正在取消并清理临时文件')
    this.abortControllers.get(id)?.abort()
    return operation
  }

  private async execute(operation: Operation): Promise<void> {
    try {
      if (operation.kind === 'install') await this.install(operation)
      else if (operation.kind === 'activate') await this.activate(operation)
      else if (operation.kind === 'deactivate') await this.deactivate(operation)
      else if (operation.kind === 'pin') await this.pin(operation)
      else if (operation.kind === 'unpin') await this.unpin(operation)
      else if (operation.kind === 'update') await this.updateSkin(operation)
      else await this.uninstall(operation)
      this.update(operation, 'done', operation.message)
    } catch (error) {
      if (this.abortControllers.get(operation.id)?.signal.aborted === true) this.update(operation, 'cancelled', '操作已取消')
      else {
        if (error instanceof PnpmCommandError) {
          const failure = error.failure
          const action = failure.kind === 'network' || failure.kind === 'fetch-timeout'
            ? 'retry'
            : failure.kind === 'build-approval' && failure.buildKey !== undefined && this.hostKind !== 'desktop'
              ? 'approve-build'
              : undefined
          const operationFailure: OperationFailure = {
            kind: failure.kind,
            message: failure.message,
            ...(failure.packageName === undefined ? {} : { packageName: failure.packageName }),
            ...(action === undefined ? {} : { action }),
          }
          operation.failure = operationFailure
          if (failure.buildKey !== undefined) this.pendingBuildKeys.set(operation.id, failure.buildKey)
        }
        if (error instanceof InstallConflictError) {
          operation.failure = { kind: 'conflict', message: error.message, conflicts: error.conflicts }
        }
        if (operation.failure === undefined && (operation.kind === 'install' || operation.kind === 'update') && assessCompatibility(this.skin(operation.skinId), this.runtime).decision === 'incompatible') {
          operation.failure = { kind: 'compatibility', message: errorMessage(error) }
        }
        this.update(operation, 'failed', errorMessage(error))
      }
    } finally {
      this.activeOperation = null
      this.abortControllers.delete(operation.id)
      const timer = setTimeout(() => {
        this.operations.delete(operation.id)
        this.pendingBuildKeys.delete(operation.id)
      }, 30 * 60 * 1000)
      timer.unref?.()
    }
  }

  private async run(args: readonly string[], operation?: Operation): Promise<void> {
    const controller = operation === undefined ? undefined : this.abortControllers.get(operation.id)
    if (controller?.signal.aborted === true) throw new Error('操作已取消')
    const ensurePnpm = this.options.runner.ensurePnpm
    if (ensurePnpm !== undefined) await ensurePnpm({ signal: controller?.signal })
    const tracker = operation === undefined ? undefined : new PnpmProgressTracker()
    await runPnpmWithRecovery(args, {
      attempt: async (attemptArgs, attemptOptions) => {
        const commandArgs = tracker === undefined || attemptArgs.some(arg => arg.startsWith('--reporter')) ? attemptArgs : [...attemptArgs, '--reporter=ndjson']
        return this.options.runner(this.options.profile, commandArgs, {
          signal: controller?.signal,
          env: { pnpm_config_fetch_timeout: String(10 * 60 * 1000), ...attemptOptions?.env },
          onStdout: chunk => tracker?.push(chunk, operation!),
          onStderr: chunk => tracker?.push(chunk, operation!),
        })
      },
      onRetry: failure => {
        if (operation !== undefined) this.update(operation, operation.phase, recoveryMessage(failure))
      },
    })
  }

  private async installPackage(skin: SkinEntry, operation: Operation): Promise<void> {
    if (this.hostKind === 'desktop') {
      const capability = skin.install.desktop
      if (capability?.mode !== 'managed') throw new Error(desktopInstallError(capability))
      if (capability.packageName !== skin.package || capability.packageVersion !== skin.install.version) {
        throw new Error('Desktop 安装元数据与皮肤固定版本不一致，请等待市场重新抓取')
      }
      const installPlugin = this.options.runner.installPlugin
      if (installPlugin === undefined) throw new Error('当前 Desktop 未提供受支持的插件安装服务')
      this.update(operation, 'installing')
      const controller = this.abortControllers.get(operation.id)
      const tracker = new PnpmProgressTracker()
      const request: PluginInstallRequest = {
        packageName: capability.packageName,
        packageVersion: capability.packageVersion,
        receiptId: randomUUID(),
        pnpmOptions: ['--prefer-offline', '--reporter=ndjson'],
      }
      await runPnpmWithRecovery(request.pnpmOptions ?? [], {
        attempt: (pnpmOptions) => installPlugin(this.options.profile, { ...request, pnpmOptions }, {
          signal: controller?.signal,
          onStdout: chunk => tracker.push(chunk, operation),
          onStderr: chunk => tracker.push(chunk, operation),
        }),
        onRetry: failure => this.update(operation, operation.phase, recoveryMessage(failure)),
      })
      return
    }

    const target = await this.prefetch(skin, operation)
    assertNoLoaderConflicts(this.options.profileDir, skin)
    this.assertRuntimeLoaderConflicts(skin)
    this.update(operation, 'installing')
    const buildApprovalKey = buildApprovalKeyForTarget(skin, target) ?? effectiveBuildApprovalKey(skin)
    if (buildApprovalKey !== undefined) ensureBuildAllowed(this.options.profileDir, buildApprovalKey)
    await this.installCompanions(skin, operation)
    await this.run(['add', target, '--prefer-offline', ...(isNpmInstallTarget(skin, target) ? ['--save-exact'] : [])], operation)
  }

  private async installCompanions(skin: SkinEntry, operation: Operation): Promise<void> {
    for (const companion of skin.install.companions ?? []) {
      if (companionNeedsInstall(this.options.profileDir, companion)) {
        await this.run(['add', companion.target, '--prefer-offline'], operation)
      }
      ensureSkinRegistration(this.options.profileDir, companionAsSkin(skin, companion), false)
    }
  }

  private companionStillNeeded(packageName: string, exceptSkinId: string): boolean {
    return this.catalog.some(item => {
      if (item.id === exceptSkinId) return false
      if (!(item.install.companions ?? []).some(companion => companion.package === packageName)) return false
      return readDependencies(this.options.profileDir)[item.package] !== undefined
    })
  }

  private async uninstallUnusedCompanions(skin: SkinEntry, operation: Operation): Promise<void> {
    for (const companion of skin.install.companions ?? []) {
      if (this.companionStillNeeded(companion.package, skin.id)) continue
      if (readDependencies(this.options.profileDir)[companion.package] === undefined) continue
      await this.run(['remove', companion.package], operation)
      removeSkinRegistration(this.options.profileDir, companionAsSkin(skin, companion))
    }
  }

  private assertRuntimeLoaderConflicts(skin: SkinEntry): void {
    const conflicts = []
    for (const entry of this.host.loader.entries()) {
      const id = entry.options.id
      const name = entry.options.name
      if (id !== skin.rowId && name !== skin.package && !(id === skin.rowId && (name === undefined || name === skin.rowId))) continue
      if (name === skin.package || (id === skin.rowId && (name === undefined || name === skin.rowId))) continue
      conflicts.push({
        kind: 'loader' as const,
        incoming: skin.package,
        existing: name ?? id ?? 'unknown loader',
        identifiers: [id, name].filter((value): value is string => value !== undefined),
      })
    }
    if (conflicts.length > 0) throw new InstallConflictError(conflicts)
  }

  private async prefetch(skin: SkinEntry, operation: Operation): Promise<string> {
    // Resolve and download into an unwatched temporary project first. pnpm's
    // content-addressed store makes the real profile add reuse these files.
    // This prevents a large GitHub download from modifying the live profile
    // early and causing DSH Web to reload before the operation can finish.
    let target = preferredInstallTarget(skin)
    let directory = mkdtempSync(join(tmpdir(), 'dsh-skin-market-download-'))
    try {
      writeFileSync(join(directory, 'package.json'), '{"private":true}\n', 'utf8')
      writeFileSync(join(directory, '.npmrc'), PNPM_FETCH_CONFIG, 'utf8')
      await this.run(['add', target, '--dir', directory, '--ignore-scripts'], operation)
      const redirected = discoverMonorepoTarget(directory, skin, target)
      if (redirected !== null) {
        target = redirected
        rmSync(directory, { recursive: true, force: true })
        directory = mkdtempSync(join(tmpdir(), 'dsh-skin-market-download-'))
        writeFileSync(join(directory, 'package.json'), '{"private":true}\n', 'utf8')
        writeFileSync(join(directory, '.npmrc'), PNPM_FETCH_CONFIG, 'utf8')
        await this.run(['add', target, '--dir', directory, '--ignore-scripts'], operation)
      }
      return target
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  }

  private async install(operation: Operation): Promise<void> {
    const skin = this.skin(operation.skinId)
    this.assertRuntimeCompatibility(skin)
    await this.syncPnpmMetadata(operation, '正在修复 profile 的 pnpm 锁文件')
    const existingSpec = readDependencies(this.options.profileDir)[skin.package]
    if (existingSpec !== undefined) {
      let validation = validateInstalledSkin(this.options.profileDir, skin)
      if (!validation.ok && validation.repairable === true) {
        await this.repairMaterializedPackage(skin, operation)
        validation = validateInstalledSkin(this.options.profileDir, skin)
      }
      if (!validation.ok) throw new Error(validation.reason)
      if (!installedSpecMatches(skin, existingSpec)) {
        throw new Error(`installed package ${skin.package} does not match the reviewed source/version; use Update to replace it with ${skin.install.target}`)
      }
      const snapshot = snapshotInstallFiles(this.options.profileDir, skin.package, skin.install.version)
      try {
        await this.installCompanions(skin, operation)
        await this.applyCompatibility(skin, operation)
        validation = validateInstalledSkin(this.options.profileDir, skin)
        if (!validation.ok) throw new Error(validation.reason)
        const state = readMarketState(this.options.profileDir)
        ensureSkinRegistration(this.options.profileDir, skin, !enabledSkinIds(state).has(skin.id))
        this.reconcileDisabledSkinIds(state)
        writeMarketState(this.options.profileDir, state)
        operation.message = 'skin was already installed; market state reconciled'
        return
      } catch (error) {
        restoreProfileInstallFiles(this.options.profileDir, skin.package, skin.install.version, snapshot)
        if (this.abortControllers.get(operation.id)?.signal.aborted !== true) {
          try { await this.run(['install'], operation) } catch { /* retain original failure */ }
        }
        restoreProfileInstallFiles(this.options.profileDir, skin.package, skin.install.version, snapshot)
        throw error
      }
    }
    const approvedBuildKey = this.pendingBuildKeys.get(operation.id)
    if (approvedBuildKey !== undefined) ensureBuildAllowed(this.options.profileDir, approvedBuildKey)
    const snapshot = snapshotInstallFiles(this.options.profileDir, skin.package, skin.install.version)
    const detachedPatchFiles = detachCompatibilityPatches(this.options.profileDir, skin.package)
    this.update(operation, 'resolving')
    try {
      await this.syncPnpmMetadata(operation, '正在清理旧的兼容适配')
      this.update(operation, 'downloading')
      await this.installPackage(skin, operation)
      await this.applyCompatibility(skin, operation)
      this.update(operation, 'validating')
      const validation = validateInstalledSkin(this.options.profileDir, skin)
      if (!validation.ok) throw new Error(validation.reason)
      if (!installedSpecMatches(skin, readDependencies(this.options.profileDir)[skin.package])) {
        throw new Error(`installed package ${skin.package} does not match the reviewed source/version ${skin.install.target}`)
      }
      assertNoLoaderConflicts(this.options.profileDir, skin)
      ensureSkinRegistration(this.options.profileDir, skin)
      const state = readMarketState(this.options.profileDir)
      state.activeSkinId = state.activeSkinId === skin.id ? null : state.activeSkinId
      if (!state.disabledSkinIds.includes(skin.id)) state.disabledSkinIds.push(skin.id)
      recordActivity(state, skin.id, 'installedAt', operation.startedAt)
      writeMarketState(this.options.profileDir, state)
      cleanupCompatibilityPatchFiles(detachedPatchFiles.filter(file => file !== compatibilityPatchFile(this.options.profileDir, skin.package, skin.install.version)))
      operation.message = 'installed; choose Use to activate'
    } catch (error) {
      restoreProfileInstallFiles(this.options.profileDir, skin.package, skin.install.version, snapshot)
      if (this.abortControllers.get(operation.id)?.signal.aborted !== true) {
        try { await this.run(['install']) } catch { /* retain the original failure */ }
      }
      // The repair install may rewrite pnpm-lock.yaml while it restores node_modules.
      // Keep the profile metadata byte-for-byte identical to its pre-operation state.
      restoreProfileInstallFiles(this.options.profileDir, skin.package, skin.install.version, snapshot)
      throw error
    }
  }

  private async activate(operation: Operation): Promise<void> {
    const skin = this.skin(operation.skinId)
    if (readDependencies(this.options.profileDir)[skin.package] === undefined) throw new Error('install the skin before using it')
    this.update(operation, 'activating')
    const previous = readMarketState(this.options.profileDir)
    const next: PersistedMarketState = { ...previous, version: 1, activeSkinId: skin.id, pinnedSkinIds: pinnedSkinIds(previous) }
    recordActivity(next, skin.id, 'usedAt', operation.startedAt)
    this.reconcileDisabledSkinIds(next)
    const requiresRestart = this.requiresRestartForTransition(previous, next)
    const enabled = enabledSkinIds(next)
    try {
      for (const item of this.catalog) {
        const installed = readDependencies(this.options.profileDir)[item.package] !== undefined
        if (installed && enabled.has(item.id)) {
          ensureSkinRegistration(this.options.profileDir, item, false)
        }
        if (installed && !enabled.has(item.id)) ensureSkinRegistration(this.options.profileDir, item, true)
      }
      let active: { found: boolean; live: boolean } | undefined
      if (!requiresRestart) {
        for (const item of this.catalog) {
          if (!enabled.has(item.id)) await this.setEntryDisabled(item, true)
        }
        for (const item of this.catalog) {
          if (enabled.has(item.id) && readDependencies(this.options.profileDir)[item.package] !== undefined) {
            await this.setEntryDisabled(item, false)
          }
        }
        active = await this.setEntryDisabled(skin, false)
      }
      writeMarketState(this.options.profileDir, next)
      if (requiresRestart) {
        operation.message = 'activation saved; restart DSH to load this skin'
      } else {
        operation.message = active?.found && active.live ? 'skin is active' : 'activation saved; restart DSH to load this skin'
      }
    } catch (error) {
      writeMarketState(this.options.profileDir, previous)
      await this.replay()
      throw error
    }
  }

  private async deactivate(operation: Operation): Promise<void> {
    const skin = this.skin(operation.skinId)
    this.update(operation, 'activating')
    const previous = readMarketState(this.options.profileDir)
    const state = { ...previous, pinnedSkinIds: pinnedSkinIds(previous) }
    state.activeSkinId = state.activeSkinId === skin.id ? null : state.activeSkinId
    state.pinnedSkinIds = state.pinnedSkinIds.filter(id => id !== skin.id)
    this.reconcileDisabledSkinIds(state)
    const requiresRestart = this.requiresRestartForTransition(previous, state)
    ensureSkinRegistration(this.options.profileDir, skin, true)
    if (!requiresRestart) await this.setEntryDisabled(skin, true)
    writeMarketState(this.options.profileDir, state)
    operation.message = requiresRestart
      ? 'skin disabled; restart DSH to apply the change'
      : enabledSkinIds(state).size === 0 ? 'DSH default appearance restored; package kept installed' : 'skin disabled; other enabled skins were kept active'
  }

  private async pin(operation: Operation): Promise<void> {
    const skin = this.skin(operation.skinId)
    const previous = readMarketState(this.options.profileDir)
    if (readDependencies(this.options.profileDir)[skin.package] === undefined) throw new Error('install the skin before pinning it')
    this.update(operation, 'activating')
    const next: PersistedMarketState = { ...previous, pinnedSkinIds: [...new Set([...pinnedSkinIds(previous), skin.id])] }
    this.reconcileDisabledSkinIds(next)
    const requiresRestart = this.requiresRestartForTransition(previous, next)
    try {
      ensureSkinRegistration(this.options.profileDir, skin, false)
      writeMarketState(this.options.profileDir, next)
      if (requiresRestart) {
        operation.message = 'pin saved; restart DSH to load this skin'
      } else {
        const active = await this.setEntryDisabled(skin, false)
        operation.message = active.found && active.live ? 'skin is pinned and active' : 'pin saved; restart DSH to load this skin'
      }
    } catch (error) {
      writeMarketState(this.options.profileDir, previous)
      await this.replay()
      throw error
    }
  }

  private async unpin(operation: Operation): Promise<void> {
    const skin = this.skin(operation.skinId)
    const previous = readMarketState(this.options.profileDir)
    if (!pinnedSkinIds(previous).includes(skin.id)) throw new Error('skin is not pinned')
    this.update(operation, 'activating')
    const next: PersistedMarketState = { ...previous, pinnedSkinIds: pinnedSkinIds(previous).filter(id => id !== skin.id) }
    this.reconcileDisabledSkinIds(next)
    const requiresRestart = this.requiresRestartForTransition(previous, next)
    try {
      if (next.activeSkinId !== skin.id) {
        ensureSkinRegistration(this.options.profileDir, skin, true)
        if (!requiresRestart) await this.setEntryDisabled(skin, true)
      }
      writeMarketState(this.options.profileDir, next)
      operation.message = requiresRestart
        ? 'skin is no longer pinned; restart DSH to apply the change'
        : next.activeSkinId === skin.id ? 'skin is no longer pinned and remains the current skin' : 'skin is no longer pinned and was disabled'
    } catch (error) {
      writeMarketState(this.options.profileDir, previous)
      await this.replay()
      throw error
    }
  }

  private async updateSkin(operation: Operation): Promise<void> {
    const skin = this.skin(operation.skinId)
    this.assertRuntimeCompatibility(skin)
    await this.syncPnpmMetadata(operation, '正在修复 profile 的 pnpm 锁文件')
    const previousState = readMarketState(this.options.profileDir)
    const wasActive = enabledSkinIds(previousState).has(skin.id)
    const approvedBuildKey = this.pendingBuildKeys.get(operation.id)
    if (approvedBuildKey !== undefined) ensureBuildAllowed(this.options.profileDir, approvedBuildKey)
    const snapshot = snapshotInstallFiles(this.options.profileDir, skin.package, skin.install.version)
    const detachedPatchFiles = detachCompatibilityPatches(this.options.profileDir, skin.package)
    this.update(operation, 'resolving')
    try {
      await this.syncPnpmMetadata(operation, '正在清理旧的兼容适配')
      this.update(operation, 'downloading')
      await this.installPackage(skin, operation)
      await this.applyCompatibility(skin, operation)
      this.update(operation, 'validating')
      const validation = validateInstalledSkin(this.options.profileDir, skin)
      if (!validation.ok) throw new Error(validation.reason)
      if (validation.version !== skin.install.version || !installedSpecMatches(skin, readDependencies(this.options.profileDir)[skin.package])) {
        throw new Error(`installed package did not change to the reviewed source/version ${skin.install.target}`)
      }
      assertNoLoaderConflicts(this.options.profileDir, skin)
      ensureSkinRegistration(this.options.profileDir, skin, !wasActive)
      await this.setEntryDisabled(skin, !wasActive)
      const nextState = readMarketState(this.options.profileDir)
      recordActivity(nextState, skin.id, 'updatedAt', operation.startedAt)
      writeMarketState(this.options.profileDir, nextState)
      cleanupCompatibilityPatchFiles(detachedPatchFiles.filter(file => file !== compatibilityPatchFile(this.options.profileDir, skin.package, skin.install.version)))
      operation.message = wasActive ? 'updated and kept active' : 'updated and kept inactive'
    } catch (error) {
      restoreProfileInstallFiles(this.options.profileDir, skin.package, skin.install.version, snapshot)
      if (this.abortControllers.get(operation.id)?.signal.aborted !== true) {
        try { await this.run(['install']) } catch { /* retain original failure */ }
      }
      // The repair install may rewrite pnpm-lock.yaml while it restores node_modules.
      // Keep the profile metadata byte-for-byte identical to its pre-operation state.
      restoreProfileInstallFiles(this.options.profileDir, skin.package, skin.install.version, snapshot)
      throw error
    }
  }

  private async uninstall(operation: Operation): Promise<void> {
    const skin = this.skin(operation.skinId)
    if (readDependencies(this.options.profileDir)[skin.package] === undefined) throw new Error('skin is not installed')
    await this.syncPnpmMetadata(operation, '正在修复 profile 的 pnpm 锁文件')
    const snapshot = snapshotInstallFiles(this.options.profileDir, skin.package, skin.install.version)
    const marketStateSnapshot = snapshotFile(marketStateFile(this.options.profileDir))
    let detachedPatchFiles: string[] = []
    try {
      const state = readMarketState(this.options.profileDir)
      if (enabledSkinIds(state).has(skin.id)) await this.deactivate(operation)
      this.update(operation, 'downloading')
      await this.run(['remove', skin.package], operation)
      await this.uninstallUnusedCompanions(skin, operation)
      detachedPatchFiles = detachCompatibilityPatches(this.options.profileDir, skin.package)
      await this.syncPnpmMetadata(operation, '正在清理兼容适配并同步 pnpm 锁文件')
      removeSkinRegistration(this.options.profileDir, skin)
      const next = readMarketState(this.options.profileDir)
      next.disabledSkinIds = next.disabledSkinIds.filter(id => id !== skin.id)
      next.pinnedSkinIds = pinnedSkinIds(next).filter(id => id !== skin.id)
      if (next.activeSkinId === skin.id) next.activeSkinId = null
      if (next.activity !== undefined) delete next.activity[skin.id]
      writeMarketState(this.options.profileDir, next)
      cleanupCompatibilityPatchFiles(detachedPatchFiles)
      operation.message = 'skin uninstalled'
    } catch (error) {
      restoreProfileInstallFiles(this.options.profileDir, skin.package, skin.install.version, snapshot)
      restoreFile(marketStateFile(this.options.profileDir), marketStateSnapshot)
      if (this.abortControllers.get(operation.id)?.signal.aborted !== true) {
        try { await this.run(['install'], operation) } catch { /* retain original failure */ }
      }
      restoreProfileInstallFiles(this.options.profileDir, skin.package, skin.install.version, snapshot)
      restoreFile(marketStateFile(this.options.profileDir), marketStateSnapshot)
      throw error
    }
  }
}
