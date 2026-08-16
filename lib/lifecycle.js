import { randomUUID } from 'node:crypto';
import { commandError } from './commands.js';
import { loadCatalog } from './catalog.js';
import { readDependencies, readMarketState, restoreManifest, runtimeState, snapshotManifest, validateInstalledSkin, writeMarketState, } from './profile.js';
function errorMessage(error) { return error instanceof Error ? error.message : String(error); }
export class SkinLifecycle {
    host;
    options;
    catalog = loadCatalog().skins;
    operations = new Map();
    activeOperation = null;
    skinById = new Map(this.catalog.map(skin => [skin.id, skin]));
    disposeEvent;
    constructor(host, options) {
        this.host = host;
        this.options = options;
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
        for (const skin of this.catalog)
            await this.setEntryDisabled(skin, state.activeSkinId !== skin.id);
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
            if (state.activeSkinId === skin.id)
                state.disabledSkinIds = state.disabledSkinIds.filter(id => id !== skin.id);
            else if (!state.disabledSkinIds.includes(skin.id))
                state.disabledSkinIds.push(skin.id);
            writeMarketState(this.options.profileDir, state);
            operation.message = 'skin was already installed; market state reconciled';
            return;
        }
        const snapshot = snapshotManifest(this.options.profileDir);
        this.update(operation, 'resolving');
        try {
            this.update(operation, 'downloading');
            await this.run(['add', skin.install.target]);
            this.update(operation, 'validating');
            const validation = validateInstalledSkin(this.options.profileDir, skin);
            if (!validation.ok)
                throw new Error(validation.reason);
            const state = readMarketState(this.options.profileDir);
            state.activeSkinId = state.activeSkinId === skin.id ? null : state.activeSkinId;
            if (!state.disabledSkinIds.includes(skin.id))
                state.disabledSkinIds.push(skin.id);
            writeMarketState(this.options.profileDir, state);
            operation.message = 'installed; choose Use to activate';
        }
        catch (error) {
            restoreManifest(this.options.profileDir, snapshot);
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
            for (const other of this.catalog)
                await this.setEntryDisabled(other, other.id !== skin.id);
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
        this.update(operation, 'resolving');
        try {
            this.update(operation, 'downloading');
            await this.run(['add', skin.install.target]);
            this.update(operation, 'validating');
            const validation = validateInstalledSkin(this.options.profileDir, skin);
            if (!validation.ok || validation.version !== skin.install.version)
                throw new Error(validation.reason ?? 'installed version did not change to the reviewed version');
            if (wasActive)
                await this.activate(operation);
            else
                await this.deactivate(operation);
            operation.message = wasActive ? 'updated and kept active' : 'updated and kept inactive';
        }
        catch (error) {
            restoreManifest(this.options.profileDir, snapshot);
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
        const next = readMarketState(this.options.profileDir);
        next.disabledSkinIds = next.disabledSkinIds.filter(id => id !== skin.id);
        if (next.activeSkinId === skin.id)
            next.activeSkinId = null;
        writeMarketState(this.options.profileDir, next);
        operation.message = 'skin uninstalled';
    }
}
