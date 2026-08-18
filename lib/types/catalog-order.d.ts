export interface PreviewableCatalogEntry {
    review?: {
        preview: 'verified' | 'repository-card';
    };
    marketScreenshots?: string[];
    listScreenshot?: string;
    screenshots: string[];
}
/** Keep entries with real UI imagery ahead of repository-only placeholders. */
export declare function hasCatalogPreview(entry: PreviewableCatalogEntry): boolean;
export declare function compareCatalogOrder<T extends PreviewableCatalogEntry>(a: T, b: T, sortBy: 'stars' | 'latest', starsFor: (entry: T) => number, updatedAtFor: (entry: T) => string): number;
