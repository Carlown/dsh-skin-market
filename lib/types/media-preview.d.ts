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
export declare function generatedMediaEnabled(): boolean;
/**
 * Local testing can point the generated filenames at a local static server:
 * ?dsh-media=1&dsh-media-base=http%3A%2F%2F127.0.0.1%3A4173%2Fskin-media%2Fv1%2F
 */
export declare function generatedMediaUrl(url: string): string;
export declare function generatedMediaFor(entry: GeneratedMediaEntry, source: string | undefined, kind: 'list' | 'avatar' | 'hero' | 'gallery' | 'thumbnail' | 'recommendation' | 'card'): GeneratedImageMedia | undefined;
export declare function generatedMediaListFor(entry: GeneratedMediaEntry): GeneratedImageMedia | undefined;
