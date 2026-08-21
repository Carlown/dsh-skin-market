import { getCatalogListScreenshot, getCatalogScreenshotUrls } from './catalog-order.js';
function currentSearchParams() {
    const location = globalThis.location;
    return location === undefined ? undefined : new URLSearchParams(location.search ?? '');
}
export function generatedMediaEnabled() {
    return currentSearchParams()?.get('dsh-media') === '1';
}
/**
 * Local testing can point the generated filenames at a local static server:
 * ?dsh-media=1&dsh-media-base=http%3A%2F%2F127.0.0.1%3A4173%2Fskin-media%2Fv1%2F
 */
export function generatedMediaUrl(url) {
    const base = currentSearchParams()?.get('dsh-media-base');
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
    if (kind === 'list' || kind === 'avatar' || kind === 'recommendation' || kind === 'card')
        return entry.media.list;
    const index = getCatalogScreenshotUrls(entry).indexOf(source);
    return index >= 0 ? entry.media.screenshots[index] ?? undefined : undefined;
}
export function generatedMediaListFor(entry) {
    return generatedMediaFor(entry, getCatalogListScreenshot(entry), 'list');
}
