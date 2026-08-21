import { getCatalogListScreenshot, getCatalogScreenshotUrls } from './catalog-order.js';
function currentSearchParams() {
    const location = globalThis.location;
    return location === undefined ? undefined : new URLSearchParams(location.search ?? '');
}
let localGeneratedMediaSources;
export function hasGeneratedMediaBase() {
    return generatedMediaBase() !== undefined;
}
export function setGeneratedMediaSources(sources) {
    localGeneratedMediaSources = sources === undefined ? undefined : new Set(sources);
}
export function generatedMediaEnabled() {
    const params = currentSearchParams();
    return params?.get('dsh-media') !== '0';
}
function generatedMediaBase() {
    const explicit = currentSearchParams()?.get('dsh-media-base');
    return explicit === null ? undefined : explicit;
}
/**
 * An explicit base is available only for testing an alternate media host.
 */
export function generatedMediaUrl(url) {
    const base = generatedMediaBase();
    if (base === undefined || base === null)
        return url;
    try {
        const filename = new URL(url).pathname.split('/').pop();
        return filename === undefined ? url : new URL(filename, base.endsWith('/') ? base : `${base}/`).toString();
    }
    catch {
        return url;
    }
}
export function generatedMediaFor(entry, source, kind) {
    if (!generatedMediaEnabled() || source === undefined || entry.media === undefined)
        return undefined;
    if (hasGeneratedMediaBase() && localGeneratedMediaSources !== undefined && !localGeneratedMediaSources.has(source))
        return undefined;
    if (kind === 'list' || kind === 'avatar' || kind === 'recommendation' || kind === 'card')
        return entry.media.list;
    const index = getCatalogScreenshotUrls(entry).indexOf(source);
    return index >= 0 ? entry.media.screenshots[index] ?? undefined : undefined;
}
export function generatedMediaListFor(entry) {
    return generatedMediaFor(entry, getCatalogListScreenshot(entry), 'list');
}
