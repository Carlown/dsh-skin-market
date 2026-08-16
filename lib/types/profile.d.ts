import type { PersistedMarketState, SkinEntry, SkinRuntimeState } from './types.ts';
export declare function resolveProfileDir(profile: string, explicit?: string): string;
export declare function manifestFile(profileDir: string): string;
export declare function marketStateFile(profileDir: string): string;
export declare function readJson<T>(file: string, fallback: T): T;
export declare function atomicWriteJson(file: string, value: unknown): void;
export declare function readMarketState(profileDir: string): PersistedMarketState;
export declare function writeMarketState(profileDir: string, state: PersistedMarketState): void;
export declare function readDependencies(profileDir: string): Record<string, string>;
export declare function packageManifest(profileDir: string, packageName: string): Record<string, unknown> | null;
export declare function validateInstalledSkin(profileDir: string, skin: SkinEntry): {
    ok: boolean;
    reason?: string;
    version?: string;
};
export interface ManifestSnapshot {
    existed: boolean;
    contents: string;
}
export declare function snapshotManifest(profileDir: string): ManifestSnapshot;
export declare function restoreManifest(profileDir: string, snapshot: ManifestSnapshot): void;
export declare function runtimeState(profileDir: string, skin: SkinEntry, activeSkinId: string | null, loaderLive: boolean, loaderFound: boolean): SkinRuntimeState;
