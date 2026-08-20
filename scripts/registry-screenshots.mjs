export function mergeScreenshots(marketScreenshots = [], upstreamScreenshots = []) {
  const upstream = marketScreenshots.length > 0
    ? upstreamScreenshots.filter(url => !isRepositoryPreviewUrl(url))
    : upstreamScreenshots
  return [...new Set([...marketScreenshots, ...upstream])].slice(0, 8)
}

/**
 * Build the renderable screenshot list without changing the source-of-truth
 * `screenshots` field. Repository-card URLs are never displayed when a
 * maintainer-provided market capture is available.
 */
export function displayScreenshots(marketScreenshots = [], upstreamScreenshots = []) {
  const upstream = upstreamScreenshots
  const usableUpstream = upstream.filter(url => !isRepositoryPreviewUrl(url))
  if (usableUpstream.length > 0) return [...new Set(usableUpstream)].slice(0, 8)
  if (marketScreenshots.length > 0) return [...new Set(marketScreenshots)].slice(0, 8)
  return [...new Set(upstream)].slice(0, 8)
}

export function isRepositoryPreviewUrl(url) {
  return url.includes('opengraph.githubassets.com/')
    || url.includes('repository-images.githubusercontent.com/')
    || url.includes('dshfind.com/api/card')
}
