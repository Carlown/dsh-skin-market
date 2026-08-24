import { type PreviewableCatalogEntry } from './catalog-order.ts';
export interface GeneratedImageMedia {
    preview: string;
    full: string;
}
export interface GeneratedMediaEntry extends PreviewableCatalogEntry {
    media?: {
        list?: GeneratedImageMedia;
        screenshots: Array<GeneratedImageMedia | null>;
    };
}
export declare function hasGeneratedMediaBase(): boolean;
export declare function setGeneratedMediaSources(sources: Iterable<string> | undefined): void;
export declare function parseGeneratedMediaManifest(value: unknown): string[] | undefined;
export declare function generatedMediaEnabled(): boolean;
export declare function generatedMediaManifestUrl(): string;
export declare function previewSourceCandidates(source: string | undefined, fallbacks?: readonly string[]): string[];
/**
 * An explicit base is available only for testing an alternate media host.
 */
export declare function generatedMediaUrl(url: string): string;
export declare function generatedMediaFor(entry: GeneratedMediaEntry, source: string | undefined, kind: 'list' | 'avatar' | 'hero' | 'gallery' | 'thumbnail' | 'recommendation' | 'card'): GeneratedImageMedia | undefined;
export declare function generatedMediaListFor(entry: GeneratedMediaEntry): GeneratedImageMedia | undefined;
