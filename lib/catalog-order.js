function isRepositoryPreviewUrl(url) {
    return url.includes('opengraph.githubassets.com/')
        || url.includes('repository-images.githubusercontent.com/')
        || url.includes('dshfind.com/api/card');
}
export function usesMarketScreenshots(entry) {
    const market = entry.marketScreenshots ?? [];
    const upstream = entry.screenshots;
    const hasUsableUpstream = entry.review?.preview !== 'repository-card'
        && upstream.some(url => !isRepositoryPreviewUrl(url));
    return market.length > 0 && !hasUsableUpstream;
}
/**
 * Returns the URLs that should actually be rendered. Market captures are
 * intentionally kept separate from the source-of-truth repository screenshots.
 */
export function getCatalogScreenshotUrls(entry) {
    const market = entry.marketScreenshots ?? [];
    const upstream = entry.screenshots;
    const usableUpstream = entry.review?.preview === 'repository-card'
        ? []
        : upstream.filter(url => !isRepositoryPreviewUrl(url));
    if (usableUpstream.length > 0)
        return [...new Set(usableUpstream)];
    if (market.length > 0)
        return [...new Set(market)];
    return [...new Set([...market, ...upstream])];
}
export function getCatalogListScreenshot(entry) {
    return getCatalogScreenshotUrls(entry)[0] ?? entry.listScreenshot;
}
/** Keep entries with real UI imagery ahead of repository-only placeholders. */
export function hasCatalogPreview(entry) {
    const hasMarketScreenshots = (entry.marketScreenshots?.length ?? 0) > 0;
    const hasUsableUpstream = entry.review?.preview !== 'repository-card'
        && entry.screenshots.some(url => !isRepositoryPreviewUrl(url));
    return hasUsableUpstream || hasMarketScreenshots;
}
export function compareCatalogOrder(a, b, sortBy, starsFor, updatedAtFor) {
    const aHasPreview = hasCatalogPreview(a);
    const bHasPreview = hasCatalogPreview(b);
    if (aHasPreview !== bHasPreview)
        return aHasPreview ? -1 : 1;
    return sortBy === 'latest'
        ? Date.parse(updatedAtFor(b)) - Date.parse(updatedAtFor(a))
        : starsFor(b) - starsFor(a);
}
