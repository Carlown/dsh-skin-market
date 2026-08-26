export interface CatalogSearchEntry {
    name: {
        zh: string;
        en: string;
    };
    author: string;
    description: string;
    tags: string[];
}
export declare function matchesCatalogSearch(entry: CatalogSearchEntry, query: string): boolean;
