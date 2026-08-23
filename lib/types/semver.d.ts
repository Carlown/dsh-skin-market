export interface SemverParts {
    core: [number, number, number];
    prerelease: string[];
}
export declare function parseVersion(value: string): SemverParts | null;
export declare function compareVersions(left: string, right: string): number;
/**
 * Small, dependency-free range support for registry compatibility metadata.
 * It intentionally accepts the subset used by the catalog: exact versions,
 * comparator sets, caret/tilde ranges, and `||` alternatives.
 */
export declare function satisfiesVersionRange(version: string, range: string): boolean;
export declare function isVersionRange(value: string): boolean;
