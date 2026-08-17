export function mergeScreenshots(marketScreenshots = [], upstreamScreenshots = []) {
  const upstream = marketScreenshots.length > 0
    ? upstreamScreenshots.filter(url => !url.startsWith('https://opengraph.githubassets.com/'))
    : upstreamScreenshots
  return [...new Set([...marketScreenshots, ...upstream])].slice(0, 8)
}
