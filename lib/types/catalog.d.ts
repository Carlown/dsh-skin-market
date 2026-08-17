import type { CatalogFile, CatalogSkin, SkinEntry } from './types.ts';
export declare const REMOTE_CATALOG_URL = "https://kingofsoysauce.github.io/dsh-skin-market/catalog.json";
export declare const CATALOG_REFRESH_INTERVAL_MS: number;
export declare const LOCAL_CATALOG_ENV = "DSH_SKIN_MARKET_LOCAL_CATALOG";
export declare function loadCatalog(): CatalogFile;
export declare function validateCatalog(value: unknown): CatalogFile;
export type CatalogSource = 'remote' | 'cache' | 'bundled';
export interface CatalogSnapshot {
    catalog: CatalogFile;
    source: CatalogSource;
    lastCheckedAt: string | null;
    error?: string;
}
interface FetchResponse {
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
}
export interface CatalogStoreOptions {
    remoteUrl?: string;
    /** Keep the bundled registry for local plugin development; never call the remote catalog. */
    preferBundled?: boolean;
    refreshIntervalMs?: number;
    fetcher?: (url: string, init: RequestInit) => Promise<FetchResponse>;
    now?: () => number;
}
export declare class CatalogStore {
    private readonly profileDir;
    private current;
    private source;
    private checkedAt;
    private error?;
    private refreshing?;
    private readonly remoteUrl;
    private readonly preferBundled;
    private readonly refreshIntervalMs;
    private readonly fetcher;
    private readonly now;
    constructor(profileDir: string, options?: CatalogStoreOptions);
    snapshot(): CatalogSnapshot;
    refresh(force?: boolean): Promise<CatalogSnapshot>;
    private fetchRemote;
}
export declare function repositorySlug(repo: string): string;
export declare function recommend(current: SkinEntry, catalog: SkinEntry[], stars: ReadonlyMap<string, number>): string[];
export declare function catalogWithStars(_profileDir: string, catalog?: CatalogFile): Promise<CatalogSkin[]>;
export {};
