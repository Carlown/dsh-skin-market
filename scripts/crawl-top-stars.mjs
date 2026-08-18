import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = join(root, 'data/crawl-top-stars')
const limit = 20
const inspectLimit = 200
const searchTerms = ['skin', 'theme', 'wallpaper', 'background']
const headers = {
  accept: 'application/vnd.github+json',
  'user-agent': 'dsh-skin-market-top-stars/0.1.0',
  'x-github-api-version': '2022-11-28',
}
const appearancePattern = /(?:\bskin\b|\btheme\b|\bwallpaper\b|皮肤|主题|壁纸|外观)/i
const namePattern = /(?:skin|theme|wallpaper|background|deep-whale|transparent|translucent|liquid-glass)/i
const chineseReadmePaths = ['README.zh-CN.md', 'README.zh_CN.md', 'README.zh.md', 'README-zh-CN.md', 'README-zh.md', 'README_CN.md', 'README_cn.md', 'docs/README.zh-CN.md', 'docs/README.zh.md']

async function json(url) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${(await response.text()).slice(0, 240)}`)
  return response.json()
}

async function raw(repository, branch, path) {
  const url = `https://raw.githubusercontent.com/${repository}/${encodeURIComponent(branch)}/${path}`
  try {
    const response = await fetch(url, { headers: { 'user-agent': headers['user-agent'] }, signal: AbortSignal.timeout(12000) })
    if (response.status === 404) return null
    if (!response.ok) return null
    return response.text()
  } catch { return null }
}

async function chineseReadme(repository, branch) {
  const results = await Promise.all(chineseReadmePaths.map(async path => ({ path, text: await raw(repository, branch, path) })))
  return results.find(result => result.text !== null)?.text ?? null
}

function packageSignals(text) {
  if (typeof text !== 'string') return { packageName: null, version: null, bundle: false, client: false }
  try {
    const value = JSON.parse(text)
    return {
      packageName: typeof value.name === 'string' ? value.name : null,
      version: typeof value.version === 'string' ? value.version : null,
      bundle: Boolean(value.dsh?.bundle),
      client: Boolean(value.dsh?.client),
    }
  } catch { return { packageName: null, version: null, bundle: false, client: false } }
}

async function inspect(repository) {
  const [packageText, readme, readmeZh, dshSkin, skin, patch] = await Promise.all([
    raw(repository.full_name, repository.default_branch, 'package.json'),
    raw(repository.full_name, repository.default_branch, 'README.md'),
    chineseReadme(repository.full_name, repository.default_branch),
    raw(repository.full_name, repository.default_branch, 'dsh-skin.json'),
    raw(repository.full_name, repository.default_branch, 'skin.json'),
    raw(repository.full_name, repository.default_branch, 'cordis.patch.yml'),
  ])
  const packageInfo = packageSignals(packageText)
  const hasSkinManifest = typeof dshSkin === 'string' || typeof skin === 'string'
  const nameMatch = namePattern.test(repository.name)
  const descriptionMatch = appearancePattern.test(repository.description ?? '')
  const readmeLead = `${readme ?? ''}\n${readmeZh ?? ''}`.slice(0, 5000)
  const readmeMatch = appearancePattern.test(readmeLead) && /(?:DeepSeek Harness|\bDSH\b|深度求索)/i.test(readmeLead)
  const looksLikeTool = /(?:skin studio|theme studio|theme builder|theme generator|skin manager|theme manager|theme switcher|皮肤制作|主题制作|皮肤管理器|主题切换器)/i.test(readmeLead)
  const looksLikeCatalog = /(?:plugin market|plugin marketplace|awesome list|curated (?:list|directory)|插件市场|精选目录)/i.test(`${repository.description ?? ''}\n${readmeLead}`)
  const looksLikeDesktopShell = /(?:desktop|webview|tauri|electron)/i.test(repository.name) && /(?:desktop|webview|tauri|electron|桌面)/i.test(readmeLead)
  const appearanceIdentity = nameMatch || descriptionMatch || hasSkinManifest
  const installable = packageInfo.bundle || packageInfo.client
  const score = (hasSkinManifest ? 5 : 0) + (packageInfo.bundle ? 3 : 0) + (packageInfo.client ? 2 : 0) + (nameMatch ? 4 : 0) + (descriptionMatch ? 3 : 0) + (readmeMatch ? 2 : 0) + (typeof patch === 'string' ? 1 : 0)
  const accepted = appearanceIdentity && (installable || hasSkinManifest || readmeMatch) && !looksLikeTool && !looksLikeCatalog && !looksLikeDesktopShell
  return {
    repository: repository.html_url,
    fullName: repository.full_name,
    description: repository.description,
    stars: repository.stargazers_count,
    forks: repository.forks_count,
    updatedAt: repository.updated_at,
    pushedAt: repository.pushed_at,
    defaultBranch: repository.default_branch,
    package: { name: packageInfo.packageName, version: packageInfo.version },
    signals: {
      dshBundle: packageInfo.bundle,
      dshClient: packageInfo.client,
      skinManifest: hasSkinManifest,
      patch: typeof patch === 'string',
      nameMatch,
      descriptionMatch,
      readmeMatch,
      looksLikeTool,
      looksLikeCatalog,
      looksLikeDesktopShell,
    },
    score,
    accepted,
  }
}

async function main() {
  const discovered = new Map()
  for (const term of searchTerms) {
    const query = encodeURIComponent(`topic:dsh-plugin ${term} in:name,description,readme archived:false`)
    for (let page = 1; page <= 10; page += 1) {
      const result = await json(`https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=100&page=${page}`)
      const items = result.items ?? []
      for (const repository of items) discovered.set(repository.full_name, repository)
      if (items.length < 100) break
    }
  }

  const rankedDiscovery = [...discovered.values()].sort((a, b) => b.stargazers_count - a.stargazers_count || a.full_name.localeCompare(b.full_name))
  const inspected = []
  for (const repository of rankedDiscovery.slice(0, inspectLimit)) inspected.push(await inspect(repository))
  const eligibleSkins = inspected.filter(item => item.accepted).sort((a, b) => b.stars - a.stars || b.score - a.score || a.fullName.localeCompare(b.fullName))
  eligibleSkins.forEach((skin, index) => { skin.discoveryRank = index + 1 })
  const skins = eligibleSkins.slice(0, limit)
  skins.forEach((skin, index) => { skin.rank = index + 1 })

  const generatedAt = new Date().toISOString()
  const result = {
    schemaVersion: 1,
    generatedAt,
    source: 'GitHub Search API: topic:dsh-plugin, sorted by stargazers_count during discovery',
    searchTerms,
    discoveredRepositories: discovered.size,
    inspectedRepositories: inspected.length,
    requested: limit,
    returned: skins.length,
    eligibleCount: eligibleSkins.length,
    skins,
    eligibleSkins,
    rejectedDuringInspection: inspected.filter(item => !item.accepted),
  }
  const rows = skins.map(item => `| ${item.rank} | ${item.stars} | [${item.fullName}](${item.repository}) | ${item.package.name ?? '—'} | ${item.package.version ?? '—'} |`)
  const allRows = eligibleSkins.map(item => `| ${item.discoveryRank} | ${item.stars} | [${item.fullName}](${item.repository}) | ${item.package.name ?? '—'} | ${item.package.version ?? '—'} |`)
  const report = `# Top ${limit} DSH skins by GitHub Stars

Generated: ${generatedAt}

- Discovery is sorted by GitHub Stars before repository inspection.
- Source: public repositories with the \`dsh-plugin\` topic.
- Search terms: ${searchTerms.join(', ')}.
- Discovered: ${discovered.size}; inspected from the top: ${inspected.length}; returned: ${skins.length}.
- This is a candidate ranking, not automatic registry approval.

| Rank | Stars | Repository | Package | Version |
|---:|---:|---|---|---|
${rows.join('\n')}
`
  await mkdir(outputDir, { recursive: true })
  await Promise.all([
    writeFile(join(outputDir, 'top-20.json'), `${JSON.stringify(result, null, 2)}\n`),
    writeFile(join(outputDir, 'top-20.md'), report),
    writeFile(join(outputDir, 'all-skins.json'), `${JSON.stringify({ schemaVersion: 1, generatedAt, source: result.source, skins: eligibleSkins }, null, 2)}\n`),
    writeFile(join(outputDir, 'all-skins.md'), `# All discovered DSH skin repositories by GitHub Stars\n\n| Rank | Stars | Repository | Package | Version |\n|---:|---:|---|---|---|\n${allRows.join('\n')}\n`),
  ])
  console.log(`discovered ${discovered.size}, inspected ${inspected.length}, eligible ${eligibleSkins.length}, returned top ${skins.length}`)
  for (const item of skins) console.log(`${String(item.rank).padStart(2)}  ${String(item.stars).padStart(5)}  ${item.fullName}`)
}

await main()
