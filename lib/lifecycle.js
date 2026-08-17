import { randomUUID } from 'node:crypto';
import { commandError } from './commands.js';
import { loadCatalog } from './catalog.js';
import { ensureBuildAllowed, ensureSkinRegistration, pnpmWorkspaceFile, profilePatchFile, readDependencies, readMarketState, readProfileBundles, removeSkinRegistration, restoreFile, restoreManifest, runtimeState, snapshotFile, snapshotManifest, validateInstalledSkin, writeMarketState, } from './profile.js';
function errorMessage(error) { return error instanceof Error ? error.message : String(error); }
export class SkinLifecycle {
    host;
    options;
    operations = new Map();
    activeOperation = null;
    catalogEntries;
    skinById;
    disposeEvent;
    constructor(host, options, catalog = loadCatalog().skins) {
        this.host = host;
        this.options = options;
        this.catalogEntries = catalog;
        this.skinById = new Map(catalog.map(skin => [skin.id, skin]));
    }
    get catalog() { return this.catalogEntries; }
    async replaceCatalog(catalog) {
        this.catalogEntries = catalog;
        this.skinById = new Map(catalog.map(skin => [skin.id, skin]));
        await this.replay();
    }
    start() {
        void this.replay();
        this.disposeEvent = this.host.on?.('internal/plugin', fiber => {
            const name = fiber.entry?.options?.name;
            const id = fiber.entry?.options?.id;
            const skin = this.catalog.find(item => item.rowId === name || item.rowId === id || item.package === name);
            if (skin === undefined)
                return;
            const state = readMarketState(this.options.profileDir);
            const shouldDisable = state.activeSkinId !== skin.id;
            void this.setEntryDisabled(skin, shouldDisable);
        });
    }
    dispose() { this.disposeEvent?.(); }
    skin(id) {
        const skin = this.skinById.get(id);
        if (skin === undefined)
            throw new Error('skin is not in the curated registry');
        return skin;
    }
    entriesFor(skin) {
        return [...this.host.loader.entries()].filter(entry => {
            const name = entry.options.name;
            const id = entry.options.id;
            return name === skin.rowId || id === skin.rowId || name === skin.package || id === skin.package;
        });
    }
    async setEntryDisabled(skin, disabled) {
        const entries = this.entriesFor(skin);
        for (const entry of entries)
            await entry.update({ disabled: disabled ? true : null }, false, true);
        return { found: entries.length > 0, live: entries.some(entry => entry.fiber !== undefined) };
    }
    async replay() {
        const state = readMarketState(this.options.profileDir);
        const dependencies = readDependencies(this.options.profileDir);
        const installed = this.catalog.filter(skin => dependencies[skin.package] !== undefined);
        const rootBundles = new Set(readProfileBundles(this.options.profileDir));
        // A complete skin bundle remains in dsh.profile.bundles even when the
        // market manages its disabled state. Only adopt an explicitly bundled
        // skin when it has not already been marked as market-managed.
        const manuallyActive = state.activeSkinId === null
            ? installed.filter(skin => rootBundles.has(skin.package) && !state.disabledSkinIds.includes(skin.id)).at(-1)
            : undefined;
        if (manuallyActive !== undefined) {
            state.activeSkinId = manuallyActive.id;
            state.disabledSkinIds = this.catalog.filter(skin => skin.id !== manuallyActive.id).map(skin => skin.id);
            writeMarketState(this.options.profileDir, state);
        }
        else if (state.activeSkinId === null) {
            const disabledSkinIds = [...new Set([...state.disabledSkinIds, ...installed.map(skin => skin.id)])];
            if (disabledSkinIds.length !== state.disabledSkinIds.length) {
                state.disabledSkinIds = disabledSkinIds;
                writeMarketState(this.options.profileDir, state);
            }
        }
        for (const skin of installed)
            ensureSkinRegistration(this.options.profileDir, skin, state.activeSkinId !== skin.id);
        for (const skin of this.catalog)
            await this.setEntryDisabled(skin, true);
        const active = this.catalog.find(skin => skin.id === state.activeSkinId);
        if (active !== undefined)
            await this.setEntryDisabled(active, false);
    }
    states() {
        const state = readMarketState(this.options.profileDir);
        return this.catalog.map(skin => {
            const entries = this.entriesFor(skin);
            return runtimeState(this.options.profileDir, skin, state.activeSkinId, entries.some(entry => entry.fiber !== undefined), entries.length > 0);
        });
    }
    currentOperation() {
        return this.activeOperation === null ? null : this.operations.get(this.activeOperation) ?? null;
    }
    begin(kind, skinId) {
        this.skin(skinId);
        if (this.activeOperation !== null)
            throw new Error('another skin operation is already running');
        const operation = { id: randomUUID(), kind, skinId, phase: 'queued', startedAt: new Date().toISOString() };
        this.operations.set(operation.id, operation);
        this.activeOperation = operation.id;
        void this.execute(operation);
        return operation;
    }
    update(operation, phase, message) {
        operation.phase = phase;
        operation.message = message;
        if (phase === 'done' || phase === 'failed')
            operation.finishedAt = new Date().toISOString();
    }
    async execute(operation) {
        try {
            if (operation.kind === 'install')
                await this.install(operation);
            else if (operation.kind === 'activate')
                await this.activate(operation);
            else if (operation.kind === 'deactivate')
                await this.deactivate(operation);
            else if (operation.kind === 'update')
                await this.updateSkin(operation);
            else
                await this.uninstall(operation);
            this.update(operation, 'done', operation.message);
        }
        catch (error) {
            this.update(operation, 'failed', errorMessage(error));
        }
        finally {
            this.activeOperation = null;
            const timer = setTimeout(() => this.operations.delete(operation.id), 30 * 60 * 1000);
            timer.unref?.();
        }
    }
    async run(args) {
        const result = await this.options.runner(this.options.profile, args);
        if (result.exitCode !== 0 || result.timedOut)
            throw new Error(commandError(result));
    }
    async install(operation) {
        const skin = this.skin(operation.skinId);
        if (readDependencies(this.options.profileDir)[skin.package] !== undefined) {
            const validation = validateInstalledSkin(this.options.profileDir, skin);
            if (!validation.ok)
                throw new Error(validation.reason);
            const state = readMarketState(this.options.profileDir);
            ensureSkinRegistration(this.options.profileDir, skin, state.activeSkinId !== skin.id);
            if (state.activeSkinId === skin.id)
                state.disabledSkinIds = state.disabledSkinIds.filter(id => id !== skin.id);
            else if (!state.disabledSkinIds.includes(skin.id))
                state.disabledSkinIds.push(skin.id);
            writeMarketState(this.options.profileDir, state);
            operation.message = 'skin was already installed; market state reconciled';
            return;
        }
        const snapshot = snapshotManifest(this.options.profileDir);
        const patchSnapshot = snapshotFile(profilePatchFile(this.options.profileDir));
        const workspaceSnapshot = snapshotFile(pnpmWorkspaceFile(this.options.profileDir));
        this.update(operation, 'resolving');
        try {
            this.update(operation, 'downloading');
            if (skin.install.allowBuild !== undefined)
                ensureBuildAllowed(this.options.profileDir, skin.install.allowBuild);
            await this.run(['add', skin.install.target]);
            this.update(operation, 'validating');
            const validation = validateInstalledSkin(this.options.profileDir, skin);
            if (!validation.ok)
                throw new Error(validation.reason);
            ensureSkinRegistration(this.options.profileDir, skin);
            const state = readMarketState(this.options.profileDir);
            state.activeSkinId = state.activeSkinId === skin.id ? null : state.activeSkinId;
            if (!state.disabledSkinIds.includes(skin.id))
                state.disabledSkinIds.push(skin.id);
            writeMarketState(this.options.profileDir, state);
            operation.message = 'installed; choose Use to activate';
        }
        catch (error) {
            restoreManifest(this.options.profileDir, snapshot);
            restoreFile(profilePatchFile(this.options.profileDir), patchSnapshot);
            restoreFile(pnpmWorkspaceFile(this.options.profileDir), workspaceSnapshot);
            try {
                await this.run(['install']);
            }
            catch { /* retain the original failure */ }
            throw error;
        }
    }
    async activate(operation) {
        const skin = this.skin(operation.skinId);
        if (readDependencies(this.options.profileDir)[skin.package] === undefined)
            throw new Error('install the skin before using it');
        this.update(operation, 'activating');
        const previous = readMarketState(this.options.profileDir);
        const next = { version: 1, activeSkinId: skin.id, disabledSkinIds: this.catalog.filter(item => item.id !== skin.id).map(item => item.id) };
        try {
            ensureSkinRegistration(this.options.profileDir, skin, false);
            // Switching must be two distinct phases. Enabling the target while the
            // old skin is still disposing can leave both global style sets mounted.
            for (const item of this.catalog)
                await this.setEntryDisabled(item, true);
            writeMarketState(this.options.profileDir, next);
            const active = await this.setEntryDisabled(skin, false);
            operation.message = active.found && active.live ? 'skin is active' : 'activation saved; restart DSH to load this skin';
        }
        catch (error) {
            writeMarketState(this.options.profileDir, previous);
            await this.replay();
            throw error;
        }
    }
    async deactivate(operation) {
        const skin = this.skin(operation.skinId);
        this.update(operation, 'activating');
        const state = readMarketState(this.options.profileDir);
        ensureSkinRegistration(this.options.profileDir, skin, true);
        await this.setEntryDisabled(skin, true);
        if (state.activeSkinId === skin.id)
            state.activeSkinId = null;
        if (!state.disabledSkinIds.includes(skin.id))
            state.disabledSkinIds.push(skin.id);
        writeMarketState(this.options.profileDir, state);
        operation.message = 'DSH default appearance restored; package kept installed';
    }
    async updateSkin(operation) {
        const skin = this.skin(operation.skinId);
        const wasActive = readMarketState(this.options.profileDir).activeSkinId === skin.id;
        const snapshot = snapshotManifest(this.options.profileDir);
        const patchSnapshot = snapshotFile(profilePatchFile(this.options.profileDir));
        const workspaceSnapshot = snapshotFile(pnpmWorkspaceFile(this.options.profileDir));
        this.update(operation, 'resolving');
        try {
            this.update(operation, 'downloading');
            if (skin.install.allowBuild !== undefined)
                ensureBuildAllowed(this.options.profileDir, skin.install.allowBuild);
            await this.run(['add', skin.install.target]);
            this.update(operation, 'validating');
            const validation = validateInstalledSkin(this.options.profileDir, skin);
            if (!validation.ok || validation.version !== skin.install.version)
                throw new Error(validation.reason ?? 'installed version did not change to the reviewed version');
            ensureSkinRegistration(this.options.profileDir, skin);
            if (wasActive)
                await this.activate(operation);
            else
                await this.deactivate(operation);
            operation.message = wasActive ? 'updated and kept active' : 'updated and kept inactive';
        }
        catch (error) {
            restoreManifest(this.options.profileDir, snapshot);
            restoreFile(profilePatchFile(this.options.profileDir), patchSnapshot);
            restoreFile(pnpmWorkspaceFile(this.options.profileDir), workspaceSnapshot);
            try {
                await this.run(['install']);
            }
            catch { /* retain original failure */ }
            throw error;
        }
    }
    async uninstall(operation) {
        const skin = this.skin(operation.skinId);
        if (readDependencies(this.options.profileDir)[skin.package] === undefined)
            throw new Error('skin is not installed');
        const state = readMarketState(this.options.profileDir);
        if (state.activeSkinId === skin.id)
            await this.deactivate(operation);
        this.update(operation, 'downloading');
        await this.run(['remove', skin.package]);
        removeSkinRegistration(this.options.profileDir, skin);
        const next = readMarketState(this.options.profileDir);
        next.disabledSkinIds = next.disabledSkinIds.filter(id => id !== skin.id);
        if (next.activeSkinId === skin.id)
            next.activeSkinId = null;
        writeMarketState(this.options.profileDir, next);
        operation.message = 'skin uninstalled';
    }
}
