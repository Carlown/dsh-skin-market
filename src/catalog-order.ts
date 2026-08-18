export interface PreviewableCatalogEntry {
  review?: { preview: 'verified' | 'repository-card' }
  marketScreenshots?: string[]
  listScreenshot?: string
  screenshots: string[]
}

/** Keep entries with real UI imagery ahead of repository-only placeholders. */
export function hasCatalogPreview(entry: PreviewableCatalogEntry): boolean {
  const hasMarketScreenshots = (entry.marketScreenshots?.length ?? 0) > 0
  const hasScreenshots = hasMarketScreenshots || entry.listScreenshot !== undefined || entry.screenshots.length > 0
  return hasScreenshots && (hasMarketScreenshots || entry.review?.preview !== 'repository-card')
}

export function compareCatalogOrder<T extends PreviewableCatalogEntry>(
  a: T,
  b: T,
  sortBy: 'stars' | 'latest',
  starsFor: (entry: T) => number,
  updatedAtFor: (entry: T) => string,
): number {
  const aHasPreview = hasCatalogPreview(a)
  const bHasPreview = hasCatalogPreview(b)
  if (aHasPreview !== bHasPreview) return aHasPreview ? -1 : 1
  return sortBy === 'latest'
    ? Date.parse(updatedAtFor(b)) - Date.parse(updatedAtFor(a))
    : starsFor(b) - starsFor(a)
}
