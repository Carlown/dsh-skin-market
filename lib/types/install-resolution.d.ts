import type { SkinEntry } from './types.ts';
export interface GithubTargetParts {
    repository: string;
    commit: string;
    subpath?: string;
}
export declare function parseGithubTarget(target: string): GithubTargetParts | null;
export declare function npmInstallTarget(skin: SkinEntry): string | null;
export declare function preferredInstallTarget(skin: SkinEntry): string;
export declare function isNpmInstallTarget(skin: SkinEntry, target: string): boolean;
/**
 * Inspect a root GitHub package fetched into a temporary profile. A package
 * collection is only retargeted when exactly one child is the reviewed DSH
 * package; ambiguous collections remain a catalog error instead of guessing.
 */
export declare function discoverMonorepoTarget(directory: string, skin: SkinEntry, target: string): string | null;
