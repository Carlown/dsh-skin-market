import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { parse, stringify } from 'yaml';
import { effectiveBuildApprovalKey } from './build-approval.js';
export function resolveProfileDir(profile, explicit) {
    if (explicit !== undefined)
        return explicit;
    const base = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh');
    return join(base, 'profiles', profile);
}
export function manifestFile(profileDir) { return join(profileDir, 'package.json'); }
export function profilePatchFile(profileDir) { return join(profileDir, 'cordis.patch.yml'); }
export function pnpmWorkspaceFile(profileDir) { return join(profileDir, 'pnpm-workspace.yaml'); }
export function pnpmLockfile(profileDir) { return join(profileDir, 'pnpm-lock.yaml'); }
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
    if (value.pinnedSkinIds !== undefined && !Array.isArray(value.pinnedSkinIds))
        delete value.pinnedSkinIds;
    if (value.activity !== undefined && (typeof value.activity !== 'object' || value.activity === null || Array.isArray(value.activity)))
        delete value.activity;
    if (value.managedCompanions !== undefined) {
        const normalized = normalizeManagedCompanions(value.managedCompanions);
        if (normalized === undefined)
            delete value.managedCompanions;
        else
            value.managedCompanions = normalized;
    }
    return value;
}
function normalizeManagedCompanions(value) {
    if (!isRecord(value))
        return undefined;
    const normalized = {};
    for (const [packageName, entry] of Object.entries(value)) {
        if (packageName.length === 0)
            continue;
        if (!isRecord(entry) || !Array.isArray(entry.ownerSkinIds))
            continue;
        const ownerSkinIds = [...new Set(entry.ownerSkinIds.filter((id) => typeof id === 'string' && id.length > 0))];
        if (ownerSkinIds.length > 0)
            normalized[packageName] = {
                ownerSkinIds,
                // Missing provenance never grants delete rights. This keeps older or
                // partially written state conservative during migration.
                installedByMarket: typeof entry.installedByMarket === 'boolean' ? entry.installedByMarket : false,
            };
    }
    return Object.keys(normalized).length > 0 ? normalized : undefined;
}
export function writeMarketState(profileDir, state) {
    atomicWriteJson(marketStateFile(profileDir), state);
}
export function readDependencies(profileDir) {
    return readJson(manifestFile(profileDir), {}).dependencies ?? {};
}
export function readProfileBundles(profileDir) {
    const bundles = readJson(manifestFile(profileDir), {}).dsh?.profile?.bundles;
    return Array.isArray(bundles) ? bundles : [];
}
/** Remove legacy market-promoted bundles; normal registration preserves bundle layers. */
export function removeProfileBundles(profileDir, packageNames) {
    const file = manifestFile(profileDir);
    const manifest = readJson(file, {});
    const bundles = manifest.dsh?.profile?.bundles;
    if (!Array.isArray(bundles))
        return;
    const removed = new Set(packageNames);
    const next = bundles.filter(name => !removed.has(name));
    if (next.length === bundles.length)
        return;
    manifest.dsh = { ...manifest.dsh, profile: { ...manifest.dsh?.profile, bundles: next } };
    atomicWriteJson(file, manifest);
}
export function packageDir(profileDir, packageName) {
    return join(profileDir, 'node_modules', ...packageName.split('/'));
}
export function compatibilityPatchDir(profileDir) {
    return join(profileDir, '.dsh-skin-market', 'patches');
}
export function compatibilityPatchFile(profileDir, packageName, version) {
    const safeName = `${packageName}@${version}`.replace(/[^A-Za-z0-9._-]+/g, '_');
    return join(compatibilityPatchDir(profileDir), `${safeName}.patch`);
}
function packageInstalledAt(profileDir, packageName) {
    try {
        return statSync(join(packageDir(profileDir, packageName), 'package.json')).mtime.toISOString();
    }
    catch {
        return null;
    }
}
export function packageManifest(profileDir, packageName) {
    const file = join(packageDir(profileDir, packageName), 'package.json');
    if (!existsSync(file))
        return null;
    return readJson(file, null);
}
function repositoryIdentity(value) {
    const raw = typeof value === 'string'
        ? value
        : isRecord(value) && typeof value.url === 'string' ? value.url : null;
    if (raw === null)
        return null;
    return raw
        .trim()
        .replace(/^git\+/, '')
        .replace(/^git@github\.com:/, '')
        .replace(/^ssh:\/\/git@github\.com\//, '')
        .replace(/^https:\/\/github\.com\//, '')
        .replace(/\.git$/, '')
        .replace(/\/$/, '');
}
function npmLockfileIntegrity(profileDir, packageName, version) {
    const file = pnpmLockfile(profileDir);
    if (!existsSync(file))
        return null;
    let value;
    try {
        value = parse(readFileSync(file, 'utf8'));
    }
    catch {
        return null;
    }
    if (!isRecord(value) || !isRecord(value.packages))
        return null;
    const packages = value.packages;
    const prefix = `${packageName}@${version}`;
    for (const [key, entry] of Object.entries(packages)) {
        if (!(key === prefix || key.startsWith(`${prefix}(`) || key.startsWith(`/${prefix}/`)))
            continue;
        if (!isRecord(entry) || !isRecord(entry.resolution) || typeof entry.resolution.integrity !== 'string')
            continue;
        return entry.resolution.integrity;
    }
    return null;
}
function validateInstalledNpmSource(profileDir, skin, manifest) {
    const npm = skin.install.npm;
    if (npm === undefined)
        return null;
    const repository = repositoryIdentity(manifest.repository);
    const expectedRepository = repositoryIdentity(npm.repository);
    if (repository === null || repository !== expectedRepository) {
        return `installed npm package ${skin.package} repository mismatch; expected ${npm.repository}`;
    }
    const integrity = npmLockfileIntegrity(profileDir, npm.name, npm.version);
    if (integrity !== npm.integrity) {
        return `installed npm package ${skin.package} integrity mismatch; expected the reviewed npm artifact`;
    }
    return null;
}
export function validateInstalledSkin(profileDir, skin) {
    const manifest = packageManifest(profileDir, skin.package);
    if (manifest === null)
        return {
            ok: false,
            repairable: true,
            reason: `installed package manifest missing for ${skin.package}; the plugin command returned without materializing the reviewed package`,
        };
    const manifestName = typeof manifest.name === 'string' ? manifest.name : undefined;
    if (manifestName === undefined)
        return { ok: false, reason: `installed package name missing; expected ${skin.package}` };
    if (manifestName !== skin.package)
        return {
            ok: false,
            reason: `installed package name mismatch; expected ${skin.package}, found ${manifestName}`,
        };
    const version = typeof manifest.version === 'string' ? manifest.version : undefined;
    if (version === undefined)
        return { ok: false, reason: `installed package version missing for ${skin.package}` };
    const dsh = isRecord(manifest.dsh) ? manifest.dsh : undefined;
    const client = dsh !== undefined && isRecord(dsh.client) ? dsh.client : undefined;
    if (client === undefined)
        return { ok: false, reason: `dsh client manifest missing in ${skin.package}` };
    if (client.platform !== undefined && client.platform !== 'web')
        return {
            ok: false,
            reason: `installed package ${skin.package} is not a web client (platform: ${String(client.platform)})`,
        };
    try {
        // Validate bundle metadata and its patch before writing profile overrides.
        // Client-only packages legitimately return null here.
        bundlePatchOperations(profileDir, skin.package);
    }
    catch (error) {
        return { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
    const npmError = validateInstalledNpmSource(profileDir, skin, manifest);
    if (npmError !== null)
        return { ok: false, reason: npmError };
    return { ok: true, version };
}
export function installedSpecMatches(skin, spec) {
    if (typeof spec !== 'string' || spec.length === 0)
        return false;
    if (skin.install.npm !== undefined)
        return spec.includes(skin.install.npm.version);
    return skin.install.desktop?.mode === 'managed'
        ? spec.includes(skin.install.commit) || spec.includes(skin.install.desktop.packageVersion)
        : spec.includes(skin.install.commit);
}
export function companionNeedsInstall(profileDir, companion) {
    const spec = readDependencies(profileDir)[companion.package];
    return typeof spec !== 'string' || !spec.includes(companion.commit);
}
export function companionsNeedInstall(profileDir, skin) {
    const dependencies = readDependencies(profileDir);
    const state = readMarketState(profileDir);
    return (skin.install.companions ?? []).some(companion => {
        // A package that predates market provenance is external. It must not make
        // the parent look updateable when the market cannot safely update it.
        if (dependencies[companion.package] !== undefined && state.managedCompanions?.[companion.package] === undefined)
            return false;
        return companionNeedsInstall(profileDir, companion);
    });
}
export { effectiveBuildApprovalKey };
export class InstallConflictError extends Error {
    conflicts;
    constructor(conflicts) {
        super(`发现插件安装冲突：${conflicts.map(conflict => `${conflict.kind} ${conflict.incoming} 与 ${conflict.existing} 冲突`).join('；')}`);
        this.conflicts = conflicts;
        this.name = 'InstallConflictError';
    }
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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
function collectLoaderIdentities(value, rows = [], packageName) {
    if (!isRecord(value))
        return rows;
    const record = value;
    const id = typeof record.id === 'string' ? record.id : undefined;
    const name = typeof record.name === 'string' ? record.name : undefined;
    if (id !== undefined || name !== undefined)
        rows.push({ id, name, packageName: packageName ?? name });
    if (Array.isArray(record.insert)) {
        for (const child of record.insert)
            collectLoaderIdentities(child, rows, packageName ?? name);
    }
    return rows;
}
export function packageLoaderIdentities(profileDir, packageName) {
    const bundle = bundlePatchOperations(profileDir, packageName);
    return bundle === null ? [] : bundle.flatMap(operation => collectLoaderIdentities(operation, [], packageName));
}
export function installedLoaderIdentities(profileDir, excludePackage) {
    const rows = patchOperations(profileDir).flatMap(operation => collectLoaderIdentities(operation));
    for (const packageName of Object.keys(readDependencies(profileDir))) {
        if (packageName === excludePackage)
            continue;
        rows.push(...packageLoaderIdentities(profileDir, packageName));
    }
    return rows;
}
function identityValues(identity) {
    return [identity.id, identity.name].filter((value) => value !== undefined && value !== '');
}
export function assertNoLoaderConflicts(profileDir, skin) {
    const incoming = packageLoaderIdentities(profileDir, skin.package);
    incoming.push({ id: skin.rowId, name: skin.package, packageName: skin.package });
    const existing = installedLoaderIdentities(profileDir, skin.package).filter(identity => !(identity.id === skin.rowId && (identity.packageName === undefined || identity.packageName === skin.package)));
    const conflicts = [];
    for (const incomingRow of incoming) {
        for (const existingRow of existing) {
            const identifiers = identityValues(incomingRow).filter(value => identityValues(existingRow).includes(value));
            if (identifiers.length === 0)
                continue;
            conflicts.push({
                kind: incomingRow.name === skin.package && existingRow.name !== skin.package ? 'package' : 'loader',
                incoming: incomingRow.packageName ?? skin.package,
                existing: existingRow.packageName ?? existingRow.name ?? existingRow.id ?? 'unknown loader',
                identifiers: [...new Set(identifiers)],
            });
        }
    }
    const unique = conflicts.filter((conflict, index) => conflicts.findIndex(item => JSON.stringify(item) === JSON.stringify(conflict)) === index);
    if (unique.length > 0)
        throw new InstallConflictError(unique);
}
function bundlePatchOperations(profileDir, packageName) {
    const manifest = packageManifest(profileDir, packageName);
    const dsh = isRecord(manifest?.dsh) ? manifest.dsh : undefined;
    if (dsh?.bundle === undefined)
        return null;
    if (!isRecord(dsh.bundle) || typeof dsh.bundle.patch !== 'string') {
        throw new Error(`${packageName} declares dsh.bundle without a valid patch path`);
    }
    const file = resolve(packageDir(profileDir, packageName), dsh.bundle.patch);
    if (!existsSync(file))
        throw new Error(`${packageName} bundle patch is missing: ${dsh.bundle.patch}`);
    const value = parse(readFileSync(file, 'utf8'));
    if (!Array.isArray(value))
        throw new Error(`${packageName} cordis.patch.yml must contain a YAML sequence`);
    return value;
}
function registrationMatches(row, skin) {
    return row.id === skin.rowId || row.name === skin.package;
}
function assertRegistrationMatches(row, skin) {
    if (row.id !== skin.rowId || row.name !== skin.package) {
        throw new Error(`loader registration conflicts with ${String(row.id ?? row.name)}`);
    }
}
function declaredBundleRows(value, skin, rows = []) {
    if (!isRecord(value))
        return rows;
    const row = value;
    if (registrationMatches(row, skin))
        rows.push(row);
    if (Array.isArray(value.insert)) {
        for (const child of value.insert)
            declaredBundleRows(child, skin, rows);
    }
    return rows;
}
function removeInsertedRows(values, skin) {
    return values.flatMap(value => {
        if (!isRecord(value))
            return [value];
        const row = value;
        if (registrationMatches(row, skin)) {
            assertRegistrationMatches(row, skin);
            return [];
        }
        if (Array.isArray(value.insert))
            value.insert = removeInsertedRows(value.insert, skin);
        return [value];
    });
}
function removeProfileInsertedRows(operations, skin) {
    for (const operation of operations) {
        if (Array.isArray(operation.insert))
            operation.insert = removeInsertedRows(operation.insert, skin);
    }
}
function removeEmptyInsertOperations(operations) {
    const next = operations.filter(operation => !Array.isArray(operation.insert) || operation.insert.length > 0);
    operations.splice(0, operations.length, ...next);
}
function ensureInsertedRow(operations, skin, disabled) {
    let found = false;
    const retain = (values) => values.flatMap(value => {
        if (!isRecord(value))
            return [value];
        const row = value;
        if (registrationMatches(row, skin)) {
            assertRegistrationMatches(row, skin);
            if (found)
                return [];
            found = true;
            if (disabled)
                row.disabled = true;
            else
                delete row.disabled;
            return [row];
        }
        if (Array.isArray(value.insert))
            value.insert = retain(value.insert);
        return [value];
    });
    for (const operation of operations) {
        if (Array.isArray(operation.insert))
            operation.insert = retain(operation.insert);
    }
    if (!found) {
        const operation = operations.find(item => Array.isArray(item.insert));
        if (operation !== undefined)
            operation.insert.push({ id: skin.rowId, name: skin.package, ...(disabled ? { disabled: true } : {}) });
        else
            operations.push({ insert: [{ id: skin.rowId, name: skin.package, ...(disabled ? { disabled: true } : {}) }] });
    }
}
function removeProfileOverrides(operations, skin) {
    const next = operations.filter(operation => {
        if (!isRecord(operation) || operation.id !== skin.rowId)
            return true;
        if (operation.name !== undefined && operation.name !== skin.package) {
            throw new Error(`loader registration conflicts with ${String(operation.id ?? operation.name)}`);
        }
        return false;
    });
    operations.splice(0, operations.length, ...next);
}
function ensureProfileOverride(operations, skin, disabled) {
    let found = false;
    const next = operations.filter(operation => {
        if (!isRecord(operation) || operation.id !== skin.rowId)
            return true;
        if (operation.name !== undefined && operation.name !== skin.package) {
            throw new Error(`loader registration conflicts with ${String(operation.id ?? operation.name)}`);
        }
        if (found)
            return false;
        found = true;
        if (disabled)
            operation.disabled = true;
        else
            delete operation.disabled;
        return disabled || Object.keys(operation).some(key => key !== 'id' && key !== 'name');
    });
    operations.splice(0, operations.length, ...next);
    if (!found && disabled)
        operations.push({ id: skin.rowId, disabled: true });
}
function ensureProfileBundle(profileDir, packageName) {
    const file = manifestFile(profileDir);
    const manifest = readJson(file, {});
    const bundles = manifest.dsh?.profile?.bundles;
    if (Array.isArray(bundles) && bundles.includes(packageName))
        return;
    manifest.dsh = {
        ...manifest.dsh,
        profile: { ...manifest.dsh?.profile, bundles: [...(Array.isArray(bundles) ? bundles : []), packageName] },
    };
    atomicWriteJson(file, manifest);
}
export function ensureBuildAllowed(profileDir, key) {
    const file = pnpmWorkspaceFile(profileDir);
    const parsed = existsSync(file) ? parse(readFileSync(file, 'utf8')) : {};
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
        throw new Error('profile pnpm-workspace.yaml must contain a YAML mapping');
    const workspace = parsed;
    const allowBuilds = typeof workspace.allowBuilds === 'object' && workspace.allowBuilds !== null && !Array.isArray(workspace.allowBuilds)
        ? workspace.allowBuilds
        : {};
    allowBuilds[key] = true;
    workspace.allowBuilds = allowBuilds;
    atomicWriteText(file, stringify(workspace, { lineWidth: 0 }));
}
export function ensurePatchedDependency(profileDir, packageName, version, patchFile) {
    const file = pnpmWorkspaceFile(profileDir);
    const parsed = existsSync(file) ? parse(readFileSync(file, 'utf8')) : {};
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
        throw new Error('profile pnpm-workspace.yaml must contain a YAML mapping');
    const workspace = parsed;
    const patchedDependencies = typeof workspace.patchedDependencies === 'object' && workspace.patchedDependencies !== null && !Array.isArray(workspace.patchedDependencies)
        ? workspace.patchedDependencies
        : {};
    patchedDependencies[`${packageName}@${version}`] = patchFile;
    workspace.patchedDependencies = patchedDependencies;
    atomicWriteText(file, stringify(workspace, { lineWidth: 0 }));
}
function patchedDependencyMap(value) {
    if (!isRecord(value))
        return {};
    const result = {};
    for (const [key, entry] of Object.entries(value)) {
        if (typeof entry === 'string')
            result[key] = entry;
        else if (isRecord(entry) && typeof entry.hash === 'string')
            result[key] = entry.hash;
    }
    return result;
}
function normalizedPatchedDependencyMap(value) {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}
function patchHash(file) {
    try {
        const contents = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
        return createHash('sha256').update(contents).digest('hex');
    }
    catch {
        return null;
    }
}
/**
 * pnpm records patch file hashes in pnpm-lock.yaml, not the configured paths.
 * Keep this check local so an older interrupted market operation can repair
 * its metadata before the next frozen install.
 */
export function patchedDependenciesNeedSync(profileDir) {
    const workspace = existsSync(pnpmWorkspaceFile(profileDir))
        ? parse(readFileSync(pnpmWorkspaceFile(profileDir), 'utf8'))
        : {};
    const lockfile = existsSync(pnpmLockfile(profileDir))
        ? parse(readFileSync(pnpmLockfile(profileDir), 'utf8'))
        : {};
    const configured = isRecord(workspace) ? patchedDependencyMap(workspace.patchedDependencies) : {};
    const recorded = isRecord(lockfile) ? patchedDependencyMap(lockfile.patchedDependencies) : {};
    const expected = Object.fromEntries(Object.entries(configured).map(([key, relativeFile]) => {
        const hash = patchHash(resolve(profileDir, relativeFile));
        return [key, hash ?? ''];
    }));
    return JSON.stringify(normalizedPatchedDependencyMap(expected)) !== JSON.stringify(normalizedPatchedDependencyMap(recorded));
}
/** Remove a package's patch settings but keep patch files available for rollback. */
export function detachCompatibilityPatches(profileDir, packageName) {
    const file = pnpmWorkspaceFile(profileDir);
    if (!existsSync(file))
        return [];
    const parsed = parse(readFileSync(file, 'utf8'));
    if (!isRecord(parsed))
        return [];
    const patchedDependencies = parsed.patchedDependencies;
    if (!isRecord(patchedDependencies))
        return [];
    const next = { ...patchedDependencies };
    const retainedFiles = [];
    const prefix = packageName + '@';
    const patchRoot = resolve(compatibilityPatchDir(profileDir));
    let changed = false;
    for (const [key, value] of Object.entries(patchedDependencies)) {
        if (!key.startsWith(prefix))
            continue;
        delete next[key];
        changed = true;
        if (typeof value !== 'string')
            continue;
        const patchFile = resolve(profileDir, value);
        if (patchFile.startsWith(patchRoot + sep) && existsSync(patchFile))
            retainedFiles.push(patchFile);
    }
    if (!changed)
        return [];
    if (Object.keys(next).length === 0)
        delete parsed.patchedDependencies;
    else
        parsed.patchedDependencies = next;
    atomicWriteText(file, stringify(parsed, { lineWidth: 0 }));
    return retainedFiles;
}
export function cleanupCompatibilityPatchFiles(files) {
    for (const file of files)
        if (existsSync(file))
            unlinkSync(file);
}
export function removePatchedDependency(profileDir, packageName, version) {
    const file = pnpmWorkspaceFile(profileDir);
    if (!existsSync(file))
        return;
    const parsed = parse(readFileSync(file, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
        return;
    const workspace = parsed;
    const patchedDependencies = workspace.patchedDependencies;
    if (typeof patchedDependencies !== 'object' || patchedDependencies === null || Array.isArray(patchedDependencies))
        return;
    const next = { ...patchedDependencies };
    delete next[`${packageName}@${version}`];
    if (Object.keys(next).length === 0)
        delete workspace.patchedDependencies;
    else
        workspace.patchedDependencies = next;
    atomicWriteText(file, stringify(workspace, { lineWidth: 0 }));
}
export function removeCompatibilityPatch(profileDir, packageName, version) {
    removePatchedDependency(profileDir, packageName, version);
    const file = compatibilityPatchFile(profileDir, packageName, version);
    if (existsSync(file))
        unlinkSync(file);
}
export function removeCompatibilityPatches(profileDir, packageName) {
    cleanupCompatibilityPatchFiles(detachCompatibilityPatches(profileDir, packageName));
}
export function ensureSkinRegistration(profileDir, skin, disabled = true) {
    const bundle = bundlePatchOperations(profileDir, skin.package);
    const operations = patchOperations(profileDir);
    const selfDeclared = bundle !== null && bundle.some(operation => declaredBundleRows(operation, skin).length > 0);
    if (selfDeclared) {
        // The bundle owns the loader row. The profile layer only overrides it.
        removeProfileInsertedRows(operations, skin);
        removeEmptyInsertOperations(operations);
        ensureProfileOverride(operations, skin, disabled);
    }
    else {
        // Client-only plugins, and bundles that do not declare this row, need a
        // profile-level insert. Remove stale overrides from older market versions.
        removeProfileOverrides(operations, skin);
        ensureInsertedRow(operations, skin, disabled);
    }
    writePatchOperations(profileDir, operations);
    if (bundle !== null)
        ensureProfileBundle(profileDir, skin.package);
    else
        removeProfileBundles(profileDir, [skin.package]);
}
export function removeSkinRegistration(profileDir, skin) {
    const file = profilePatchFile(profileDir);
    if (!existsSync(file))
        return;
    const operations = patchOperations(profileDir);
    removeProfileInsertedRows(operations, skin);
    removeEmptyInsertOperations(operations);
    removeProfileOverrides(operations, skin);
    writePatchOperations(profileDir, operations);
}
export function installedClientPlugins(profileDir, catalog) {
    const catalogPackages = new Set(catalog.map(skin => skin.package));
    const rows = patchOperations(profileDir)
        .flatMap(operation => operation.insert ?? [])
        .filter((value) => typeof value === 'object' && value !== null);
    return Object.entries(readDependencies(profileDir)).flatMap(([packageName, spec]) => {
        if (catalogPackages.has(packageName) || packageName === 'dsh-skin-market')
            return [];
        const manifest = packageManifest(profileDir, packageName);
        const dsh = manifest?.dsh;
        if (dsh?.client === undefined)
            return [];
        const matchingRows = rows.filter(row => row.name === packageName);
        return [{
                package: packageName,
                version: typeof manifest?.version === 'string' ? manifest.version : null,
                spec,
                rowIds: matchingRows.flatMap(row => typeof row.id === 'string' ? [row.id] : []),
                registered: matchingRows.length > 0,
            }];
    }).sort((a, b) => a.package.localeCompare(b.package));
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
function latestOperationAt(installedAt, activity) {
    const timestamps = [installedAt, activity?.installedAt, activity?.updatedAt, activity?.usedAt]
        .filter((value) => value !== undefined && value !== null && Number.isFinite(Date.parse(value)));
    return timestamps.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
}
export function runtimeState(profileDir, skin, activeSkinId, loaderLive, loaderFound, pinnedSkinIds = [], activity) {
    const dependencies = readDependencies(profileDir);
    const spec = dependencies[skin.package] ?? null;
    const primary = activeSkinId === skin.id;
    const pinned = pinnedSkinIds.includes(skin.id);
    if (spec === null) {
        return { skinId: skin.id, installation: 'missing', activation: 'inactive', primary: false, pinned: false, installedVersion: null, installedSpec: null, installedAt: null, lastOperatedAt: null, updateAvailable: false };
    }
    const installedAt = packageInstalledAt(profileDir, skin.package);
    const lastOperatedAt = latestOperationAt(installedAt, activity);
    const validation = validateInstalledSkin(profileDir, skin);
    if (!validation.ok) {
        return { skinId: skin.id, installation: 'broken', activation: 'inactive', primary, pinned, installedVersion: null, installedSpec: spec, installedAt, lastOperatedAt, updateAvailable: false, error: validation.reason };
    }
    const active = primary || pinned;
    const activation = active ? (loaderFound ? (loaderLive ? 'active' : 'restart-required') : 'restart-required') : 'inactive';
    const pinnedSpecMatches = installedSpecMatches(skin, spec);
    const updateAvailable = validation.version !== skin.install.version || !pinnedSpecMatches || companionsNeedInstall(profileDir, skin);
    return {
        skinId: skin.id,
        installation: 'installed',
        activation,
        primary,
        pinned,
        installedVersion: validation.version ?? null,
        installedSpec: spec,
        installedAt,
        lastOperatedAt,
        updateAvailable,
    };
}
