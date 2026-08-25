export interface LoaderIdentity {
    id?: string;
    name?: string;
    packageName?: string;
}
/**
 * Return only loader rows introduced by `insert` operations.
 * Top-level patch operations can be overrides or other Cordis instructions;
 * treating their id as package ownership is the source of the old false
 * conflict reports.
 */
export declare function parseInsertedLoaderRows(value: unknown, packageName?: string, rows?: LoaderIdentity[]): LoaderIdentity[];
export declare function loaderIdentifiers(identity: LoaderIdentity): string[];
export declare function sharedLoaderIdentifiers(left: LoaderIdentity, right: LoaderIdentity): string[];
export declare function primaryLoaderCandidates(rows: readonly LoaderIdentity[], packageName: string): LoaderIdentity[];
