import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { parse, stringify } from 'yaml';
export function resolveProfileDir(profile, explicit) {
    if (explicit !== undefined)
        return explicit;
    const base = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh');
    return join(base, 'profiles', profile);
}
export function manifestFile(profileDir) { return join(profileDir, 'package.json'); }
export function profilePatchFile(profileDir) { return join(profileDir, 'cordis.patch.yml'); }
export function marketStateFile(profileDir) { return join(profileDir, '.dsh-skin-market', 'state.json'); }
export function readJson(file, fallback) {
    try {
        return JSON.parse(readFileSync(file, 'utf8'));
    }
    catch {
        return fallback;
    }
}
export function atomicWriteJson(file, value) {
    atomicWriteText(file, `${JSON.stringify(value, null, 2)}\n`);
}
export function atomicWriteText(file, value) {
    mkdirSync(dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    writeFileSync(temporary, value);
    renameSync(temporary, file);
}
export function readMarketState(profileDir) {
    const fallback = { version: 1, activeSkinId: null, disabledSkinIds: [] };
    const value = readJson(marketStateFile(profileDir), fallback);
    if (value.version !== 1 || !Array.isArray(value.disabledSkinIds))
        return fallback;
    return value;
}
export function writeMarketState(profileDir, state) {
    atomicWriteJson(marketStateFile(profileDir), state);
}
export function readDependencies(profileDir) {
    return readJson(manifestFile(profileDir), {}).dependencies ?? {};
}
export function packageManifest(profileDir, packageName) {
    const file = join(profileDir, 'node_modules', ...packageName.split('/'), 'package.json');
    if (!existsSync(file))
        return null;
    return readJson(file, null);
}
export function validateInstalledSkin(profileDir, skin) {
    const manifest = packageManifest(profileDir, skin.package);
    if (manifest === null)
        return { ok: false, reason: 'package manifest missing' };
    const dsh = manifest.dsh;
    if (dsh?.client === undefined)
        return { ok: false, reason: 'dsh client manifest missing' };
    const version = typeof manifest.version === 'string' ? manifest.version : undefined;
    return { ok: true, version };
}
function patchOperations(profileDir) {
    const file = profilePatchFile(profileDir);
    if (!existsSync(file))
        return [];
    const value = parse(readFileSync(file, 'utf8'));
    if (!Array.isArray(value))
        throw new Error('profile cordis.patch.yml must contain a YAML sequence');
    return value;
}
function writePatchOperations(profileDir, operations) {
    atomicWriteText(profilePatchFile(profileDir), stringify(operations, { lineWidth: 0 }));
}
export function ensureSkinRegistration(profileDir, skin, disabled = true) {
    const operations = patchOperations(profileDir);
    let insert = operations.find(operation => Array.isArray(operation?.insert))?.insert;
    if (insert === undefined) {
        insert = [];
        operations.push({ insert });
    }
    const rows = insert.filter((value) => typeof value === 'object' && value !== null);
    const row = rows.find(value => value.id === skin.rowId || value.name === skin.package);
    if (row !== undefined && (row.id !== skin.rowId || row.name !== skin.package)) {
        throw new Error(`loader registration conflicts with ${String(row.id ?? row.name)}`);
    }
    if (row === undefined)
        insert.push({ id: skin.rowId, name: skin.package, ...(disabled ? { disabled: true } : {}) });
    else if (disabled)
        row.disabled = true;
    else
        delete row.disabled;
    writePatchOperations(profileDir, operations);
}
export function removeSkinRegistration(profileDir, skin) {
    const file = profilePatchFile(profileDir);
    if (!existsSync(file))
        return;
    const operations = patchOperations(profileDir);
    for (const operation of operations) {
        if (!Array.isArray(operation.insert))
            continue;
        operation.insert = operation.insert.filter(value => {
            if (typeof value !== 'object' || value === null)
                return true;
            const row = value;
            return row.id !== skin.rowId || row.name !== skin.package;
        });
    }
    writePatchOperations(profileDir, operations);
}
export function snapshotFile(file) {
    return existsSync(file) ? { existed: true, contents: readFileSync(file, 'utf8') } : { existed: false, contents: '' };
}
export function restoreFile(file, snapshot) {
    if (snapshot.existed)
        writeFileSync(file, snapshot.contents);
    else if (existsSync(file))
        unlinkSync(file);
}
export function snapshotManifest(profileDir) { return snapshotFile(manifestFile(profileDir)); }
export function restoreManifest(profileDir, snapshot) { restoreFile(manifestFile(profileDir), snapshot); }
export function runtimeState(profileDir, skin, activeSkinId, loaderLive, loaderFound) {
    const dependencies = readDependencies(profileDir);
    const spec = dependencies[skin.package] ?? null;
    if (spec === null) {
        return { skinId: skin.id, installation: 'missing', activation: 'inactive', installedVersion: null, installedSpec: null, updateAvailable: false };
    }
    const validation = validateInstalledSkin(profileDir, skin);
    if (!validation.ok) {
        return { skinId: skin.id, installation: 'broken', activation: 'inactive', installedVersion: null, installedSpec: spec, updateAvailable: false, error: validation.reason };
    }
    const active = activeSkinId === skin.id;
    const activation = active ? (loaderFound ? (loaderLive ? 'active' : 'restart-required') : 'restart-required') : 'inactive';
    const updateAvailable = validation.version !== skin.install.version || !spec.includes(skin.install.commit);
    return {
        skinId: skin.id,
        installation: 'installed',
        activation,
        installedVersion: validation.version ?? null,
        installedSpec: spec,
        updateAvailable,
    };
}
