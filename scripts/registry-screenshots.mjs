export function mergeScreenshots(marketScreenshots = [], upstreamScreenshots = []) {
  const upstream = marketScreenshots.length > 0
    ? upstreamScreenshots.filter(url => !isRepositoryPreviewUrl(url))
    : upstreamScreenshots
  return [...new Set([...marketScreenshots, ...upstream])].slice(0, 8)
}

function matchingScreenshots(upstreamScreenshots, subpath) {
  if (subpath === undefined || subpath.trim() === '') return []
  const normalizedSubpath = subpath.replace(/^\/+|\/+$/g, '')
  return upstreamScreenshots.filter(url => {
    try {
      const pathname = decodeURIComponent(new URL(url).pathname).replace(/^\/+|\/+$/g, '')
      return pathname === normalizedSubpath
        || pathname.includes(`/${normalizedSubpath}/`)
        || pathname.endsWith(`/${normalizedSubpath}`)
    } catch {
      return false
    }
  })
}

/**
 * Restrict a monorepo's shared screenshot list to the current package when
 * the URL path provides enough evidence to do so. Unknown URL shapes are
 * preserved instead of being guessed away.
 */
export function scopedScreenshots(upstreamScreenshots = [], subpath) {
  const unique = [...new Set(upstreamScreenshots)]
  const scoped = matchingScreenshots(unique, subpath)
  return scoped.length > 0 ? scoped : unique
}

export function hasCrossPackageScreenshots(upstreamScreenshots = [], subpath) {
  const unique = [...new Set(upstreamScreenshots)]
  if (subpath === undefined || unique.length === 0) return false
  const scoped = matchingScreenshots(unique, subpath)
  return scoped.length > 0 && scoped.length < unique.length
}

/**
 * Build the renderable screenshot list without changing the source-of-truth
 * `screenshots` field. Repository-card URLs are never displayed when a
 * maintainer-provided market capture is available.
 */
export function displayScreenshots(marketScreenshots = [], upstreamScreenshots = [], subpath) {
  const upstream = scopedScreenshots(upstreamScreenshots, subpath)
  const contaminated = hasCrossPackageScreenshots(upstreamScreenshots, subpath)
  const usableUpstream = upstream.filter(url => !isRepositoryPreviewUrl(url))
  if (contaminated) {
    const scopedDisplay = [...new Set([...marketScreenshots, ...usableUpstream])]
    if (scopedDisplay.length > 0) return scopedDisplay.slice(0, 8)
  }
  if (usableUpstream.length > 0) return [...new Set(usableUpstream)].slice(0, 8)
  if (marketScreenshots.length > 0) return [...new Set(marketScreenshots)].slice(0, 8)
  return [...new Set(upstream)].slice(0, 8)
}

export function isRepositoryPreviewUrl(url) {
  return url.includes('opengraph.githubassets.com/')
    || url.includes('repository-images.githubusercontent.com/')
    || url.includes('dshfind.com/api/card')
}
