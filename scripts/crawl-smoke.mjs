import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = join(root, 'data/crawl-smoke')
const apiHeaders = {
  accept: 'application/vnd.github+json',
  'user-agent': 'dsh-skin-market-crawl-smoke/0.1.0',
  'x-github-api-version': '2022-11-28',
}
const searchTerms = ['skin', 'theme', 'wallpaper']
const keywordPattern = /(?:\bskin\b|\btheme\b|\bwallpaper\b|皮肤|主题|外观|背景)/i

async function fetchJson(url) {
  const response = await fetch(url, { headers: apiHeaders, signal: AbortSignal.timeout(15000) })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`GitHub ${response.status} for ${url}: ${body.slice(0, 240)}`)
  }
  return response.json()
}

async function fetchRaw(repository, branch, path) {
  const url = `https://raw.githubusercontent.com/${repository}/${encodeURIComponent(branch)}/${path}`
  try {
    const response = await fetch(url, { headers: { 'user-agent': apiHeaders['user-agent'] }, signal: AbortSignal.timeout(10000) })
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.text()
  } catch (error) {
    return { fetchError: error instanceof Error ? error.message : String(error) }
  }
}

function dshDeclaration(packageJson) {
  const dsh = packageJson?.dsh
  return {
    bundle: Boolean(dsh && typeof dsh === 'object' && dsh.bundle),
    client: Boolean(dsh && typeof dsh === 'object' && dsh.client),
  }
}

async function inspect(repository) {
  const branch = repository.default_branch
  const [packageText, dshSkinText, skinText, patchText] = await Promise.all([
    fetchRaw(repository.full_name, branch, 'package.json'),
    fetchRaw(repository.full_name, branch, 'dsh-skin.json'),
    fetchRaw(repository.full_name, branch, 'skin.json'),
    fetchRaw(repository.full_name, branch, 'cordis.patch.yml'),
  ])

  let packageJson = null
  let packageError = null
  if (typeof packageText === 'string') {
    try { packageJson = JSON.parse(packageText) } catch (error) { packageError = error instanceof Error ? error.message : String(error) }
  } else if (packageText?.fetchError) packageError = packageText.fetchError

  const declaration = dshDeclaration(packageJson)
  const hasSkinManifest = typeof dshSkinText === 'string' || typeof skinText === 'string'
  const hasPatch = typeof patchText === 'string'
  const text = [repository.name, repository.description, packageJson?.name, packageJson?.description].filter(Boolean).join(' ')
  const keywordMatch = keywordPattern.test(text)
  const nameMatch = /(?:skin|theme|wallpaper)/i.test(repository.name)
  const score = (hasSkinManifest ? 5 : 0) + (declaration.bundle ? 3 : 0) + (declaration.client ? 2 : 0) + (nameMatch ? 3 : 0) + (keywordMatch ? 2 : 0) + (hasPatch ? 1 : 0)
  const reasons = []
  if (hasSkinManifest) reasons.push('skin manifest')
  if (declaration.bundle) reasons.push('dsh.bundle')
  if (declaration.client) reasons.push('dsh.client')
  if (nameMatch) reasons.push('skin/theme/wallpaper in repository name')
  if (keywordMatch) reasons.push('appearance keyword in metadata')
  if (hasPatch) reasons.push('cordis.patch.yml')
  if (packageError) reasons.push(`package inspection error: ${packageError}`)

  return {
    repository: repository.html_url,
    fullName: repository.full_name,
    description: repository.description,
    defaultBranch: branch,
    stars: repository.stargazers_count,
    updatedAt: repository.updated_at,
    pushedAt: repository.pushed_at,
    archived: repository.archived,
    topics: repository.topics ?? [],
    package: packageJson === null ? null : { name: packageJson.name ?? null, version: packageJson.version ?? null },
    signals: { ...declaration, hasSkinManifest, hasPatch, nameMatch, keywordMatch },
    score,
    verdict: score >= 8 ? 'probable-skin' : score >= 5 ? 'needs-review' : 'weak-match',
    reasons,
  }
}

async function main() {
  const repositories = new Map()
  for (const term of searchTerms) {
    const query = encodeURIComponent(`topic:dsh-plugin ${term} in:name,description,readme archived:false`)
    const result = await fetchJson(`https://api.github.com/search/repositories?q=${query}&sort=updated&order=desc&per_page=10`)
    for (const item of result.items ?? []) repositories.set(item.full_name, item)
  }

  const inspected = []
  for (const repository of repositories.values()) inspected.push(await inspect(repository))
  inspected.sort((a, b) => b.score - a.score || b.stars - a.stars || a.fullName.localeCompare(b.fullName))

  const generatedAt = new Date().toISOString()
  const result = {
    schemaVersion: 1,
    generatedAt,
    source: 'GitHub Search API: topic:dsh-plugin',
    searchTerms,
    discoveredRepositories: repositories.size,
    probableSkins: inspected.filter(item => item.verdict === 'probable-skin').length,
    needsReview: inspected.filter(item => item.verdict === 'needs-review').length,
    candidates: inspected,
  }
  const rows = inspected.map(item => `| ${item.verdict} | ${item.score} | [${item.fullName}](${item.repository}) | ${item.stars} | ${item.reasons.join(', ') || 'keyword search only'} |`)
  const report = `# DSH skin crawl smoke report

Generated: ${generatedAt}

- Source: GitHub \`dsh-plugin\` topic
- Search terms: ${searchTerms.join(', ')}
- Unique repositories inspected: ${repositories.size}
- Probable skins: ${result.probableSkins}
- Needs review: ${result.needsReview}

This is a candidate report, not the curated registry. No repository was installed or automatically approved.

| Verdict | Score | Repository | Stars | Signals |
|---|---:|---|---:|---|
${rows.join('\n')}
`

  await mkdir(outputDir, { recursive: true })
  await Promise.all([
    writeFile(join(outputDir, 'candidates.json'), `${JSON.stringify(result, null, 2)}\n`),
    writeFile(join(outputDir, 'report.md'), report),
  ])
  console.log(`inspected ${repositories.size} repositories: ${result.probableSkins} probable skins, ${result.needsReview} need review`)
  console.log(`report: ${join(outputDir, 'report.md')}`)
}

await main()
