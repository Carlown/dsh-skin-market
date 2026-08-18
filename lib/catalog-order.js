/** Keep entries with real UI imagery ahead of repository-only placeholders. */
export function hasCatalogPreview(entry) {
    const hasMarketScreenshots = (entry.marketScreenshots?.length ?? 0) > 0;
    const hasScreenshots = hasMarketScreenshots || entry.listScreenshot !== undefined || entry.screenshots.length > 0;
    return hasScreenshots && (hasMarketScreenshots || entry.review?.preview !== 'repository-card');
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
