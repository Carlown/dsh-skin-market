import { loadCatalog } from './catalog.js';
import { ensureSkinRegistration, manifestFile, marketStateFile, profilePatchFile, readDependencies, readMarketState, removeProfileBundles, restoreFile, snapshotFile, writeMarketState, } from './profile.js';
export function resetManagedSkins(profileDir, catalog = loadCatalog().skins) {
    const manifestSnapshot = snapshotFile(manifestFile(profileDir));
    const patchSnapshot = snapshotFile(profilePatchFile(profileDir));
    const stateSnapshot = snapshotFile(marketStateFile(profileDir));
    const dependencies = readDependencies(profileDir);
    const installed = catalog.filter(skin => dependencies[skin.package] !== undefined);
    try {
        removeProfileBundles(profileDir, catalog.map(skin => skin.package));
        for (const skin of installed)
            ensureSkinRegistration(profileDir, skin, true);
        const state = readMarketState(profileDir);
        state.activeSkinId = null;
        state.disabledSkinIds = [...new Set([...state.disabledSkinIds, ...installed.map(skin => skin.id)])];
        writeMarketState(profileDir, state);
        return {
            disabledSkinIds: installed.map(skin => skin.id),
            disabledPackages: installed.map(skin => skin.package),
        };
    }
    catch (error) {
        restoreFile(manifestFile(profileDir), manifestSnapshot);
        restoreFile(profilePatchFile(profileDir), patchSnapshot);
        restoreFile(marketStateFile(profileDir), stateSnapshot);
        throw error;
    }
}
