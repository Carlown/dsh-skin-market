import type { CatalogFile, CatalogSkin, SkinEntry } from './types.ts';
export declare function loadCatalog(): CatalogFile;
export declare function repositorySlug(repo: string): string;
export declare function recommend(current: SkinEntry, catalog: SkinEntry[], stars: ReadonlyMap<string, number>): string[];
export declare function catalogWithStars(_profileDir: string): Promise<CatalogSkin[]>;
