import { execFile } from 'node:child_process'
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { parse, stringify } from 'yaml'
import { permitsCommercialUse } from './license.mjs'
import { clientEntryPath, inspectSkinHealth } from './skin-health.mjs'

const run = promisify(execFile)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const registryDir = join(root, 'registry/skins')
const outputDir = join(root, 'data/full-ingestion')
const sourceUrl = 'https://awesome-dsh-plugin.com/plugins.json'
const githubSearchTerms = ['skin', 'theme', 'wallpaper', 'background']
const appearanceName = /(?:skin|theme|wallpaper|background|transparent|liquid-glass|deep-whale|deepcel)/i
const ignoredName = /(?:studio|manager|switcher|plugin-market|awesome)/i
const irrelevantName = /(?:^|#)(?:dsh-background-agents|dsh-models-dev-reasoning|pdf-background-gray-codex-skill|dsh-api-key-pool)$/i
const starsByRepository = new Map()
const verifiedStarsRepositories = new Set()

async function fetchText(url) {
  try {
    const response = await fetch(url, { headers: { 'user-agent': 'dsh-skin-market-full-ingest/0.1.0' }, signal: AbortSignal.timeout(20000) })
    if (!response.ok) return null
    return response.text()
  } catch { return null }
}

function githubTarget(url) {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com') return null
  const parts = parsed.pathname.split('/').filter(Boolean)
  if (parts.length < 2 || !/^[A-Za-z0-9_.-]+$/.test(parts[0]) || !/^[A-Za-z0-9_.-]+$/.test(parts[1])) return null
  let subpath = null
  if (parts[2] === 'tree' && parts.length >= 5) subpath = parts.slice(4).join('/')
  return { owner: parts[0], repo: parts[1], fullName: `${parts[0]}/${parts[1]}`, subpath, repository: `https://github.com/${parts[0]}/${parts[1]}` }
}

async function headSha(target) {
  try {
    const { stdout } = await run('git', ['ls-remote', `${target.repository}.git`, 'HEAD'], { timeout: 20000, maxBuffer: 1024 * 1024 })
    const sha = stdout.trim().split(/\s+/)[0]
    return /^[0-9a-f]{40}$/.test(sha) ? sha : null
  } catch { return null }
}

async function repositoryStars(target) {
  const key = target.fullName.toLowerCase()
  if (!starsByRepository.has(key)) {
    starsByRepository.set(key, (async () => {
      const headers = {
        accept: 'application/vnd.github+json',
        'user-agent': 'dsh-skin-market-full-ingest/0.1.0',
        'x-github-api-version': '2022-11-28',
      }
      if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`
      try {
        const response = await fetch(`https://api.github.com/repos/${target.fullName}`, { headers, signal: AbortSignal.timeout(20000) })
        if (response.ok) {
          const body = await response.json()
          if (Number.isInteger(body.stargazers_count) && body.stargazers_count >= 0) {
            verifiedStarsRepositories.add(key)
            return body.stargazers_count
          }
        }
      } catch { /* fall back to the public repository page */ }
      try {
        const response = await fetch(target.repository, { headers: { 'user-agent': headers['user-agent'] }, signal: AbortSignal.timeout(20000) })
        if (!response.ok) return null
        const html = await response.text()
        const value = /([\d,]+)\s+users starred this repository/i.exec(html)?.[1]
        if (!value) return null
        const stars = Number(value.replaceAll(',', ''))
        if (!Number.isInteger(stars) || stars < 0) return null
        verifiedStarsRepositories.add(key)
        return stars
      } catch { return null }
    })())
  }
  return starsByRepository.get(key)
}

async function discoverGithubPlugins() {
  const discovered = new Map()
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': 'dsh-skin-market-full-ingest/0.1.0',
    'x-github-api-version': '2022-11-28',
  }
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  for (const term of githubSearchTerms) {
    const query = encodeURIComponent(`topic:dsh-plugin ${term} in:name,description,readme archived:false`)
    for (let page = 1; page <= 10; page += 1) {
      try {
        const response = await fetch(`https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=100&page=${page}`, { headers, signal: AbortSignal.timeout(20000) })
        if (!response.ok) break
        const body = await response.json()
        const items = body.items ?? []
        for (const repository of items) {
          const appearanceText = `${repository.name ?? ''} ${repository.description ?? ''}`
          if (!appearanceName.test(appearanceText) || ignoredName.test(repository.name ?? '') || irrelevantName.test(repository.name ?? '')) continue
          discovered.set(repository.full_name.toLowerCase(), {
            owner: repository.owner?.login ?? repository.full_name.split('/')[0],
            name: repository.name,
            url: repository.html_url,
            category: 'theme',
            description: { en: repository.description || repository.name },
            stars: repository.stargazers_count,
            githubTopicSource: true,
          })
        }
        if (items.length < 100) break
      } catch { break }
    }
  }
  return [...discovered.values()]
}

async function cachedGithubPlugins() {
  try {
    const cached = JSON.parse(await readFile(join(root, 'data/crawl-top-stars/top-20.json'), 'utf8'))
    return (cached.skins ?? []).map(repository => ({
      owner: repository.fullName.split('/')[0],
      name: repository.fullName.split('/')[1],
      url: repository.repository,
      category: 'theme',
      description: { en: repository.description || repository.fullName.split('/')[1] },
      stars: repository.stars,
      githubTopicSource: true,
    }))
  } catch { return [] }
}

async function raw(target, sha, path) {
  const prefix = target.subpath ? `${target.subpath}/` : ''
  return fetchText(`https://raw.githubusercontent.com/${target.fullName}/${sha}/${prefix}${path}`)
}

function parsePackage(text) {
  if (text === null) return null
  try { return JSON.parse(text) } catch { return null }
}

function rowId(patchText) {
  if (patchText === null) return null
  const id = /(?:^|\n)\s*-?\s*id:\s*['"]?([A-Za-z0-9_.@/-]+)['"]?/m.exec(patchText)?.[1]
  return id ?? null
}

function pinnedScreenshot(value, target, sha) {
  if (!/^https:\/\//.test(value) || /\.svg(?:$|\?)/i.test(value) || /shields\.io|star-history\.com/i.test(value)) return null
  const rawMatch = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/[^/]+\/(.+)$/.exec(value)
  if (rawMatch && `${rawMatch[1]}/${rawMatch[2]}`.toLowerCase() === target.fullName.toLowerCase()) {
    return `https://raw.githubusercontent.com/${target.fullName}/${sha}/${rawMatch[3]}`
  }
  return value
}

function readmeScreenshots(readme, target, sha) {
  if (readme === null) return []
  const values = []
  for (const match of readme.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)|<img[^>]+src=["']([^"']+)["']/gi)) {
    const value = match[1] ?? match[2]
    if (!value || /\.svg(?:$|\?)/i.test(value) || /shields\.io|star-history\.com|badge/i.test(value)) continue
    if (/^https:\/\//.test(value)) {
      const pinned = pinnedScreenshot(value, target, sha)
      if (pinned) values.push(pinned)
    } else if (!value.startsWith('#')) {
      const clean = value.replace(/^\.\//, '')
      const prefix = target.subpath ? `${target.subpath}/` : ''
      values.push(`https://raw.githubusercontent.com/${target.fullName}/${sha}/${prefix}${clean}`)
    }
  }
  return [...new Set(values)].slice(0, 6)
}

function compatibility(pkg, readme) {
  const stated = /(?:DSH|DeepSeek Harness|Harness|兼容|支持)[^\n]{0,120}?((?:>=|\^|~)?\s*0\.1\.0-rc\.\d+)/i.exec(readme ?? '')?.[1]
  if (stated) return stated.replace(/\s+/g, '')
  const groups = [pkg.peerDependencies ?? {}, pkg.dependencies ?? {}, pkg.devDependencies ?? {}]
  const candidates = groups.flatMap(group => Object.entries(group).filter(([name]) => name.startsWith('@deepseek-ai/dsh-')))
  const dependency = candidates.map(([, version]) => String(version)).find(version => /\d/.test(version) && !version.startsWith('workspace:'))
  if (dependency) return dependency
  return null
}

async function commonScreenshots(target, sha) {
  const paths = ['preview.webp', 'preview.png', 'screenshot.webp', 'screenshot.png', 'docs/preview.webp', 'docs/preview.png', 'assets/preview.webp', 'assets/preview.png']
  const found = []
  for (const path of paths) {
    const prefix = target.subpath ? `${target.subpath}/` : ''
    const url = `https://raw.githubusercontent.com/${target.fullName}/${sha}/${prefix}${path}`
    try {
      const response = await fetch(url, { headers: { 'user-agent': 'dsh-skin-market-full-ingest/0.1.0' }, signal: AbortSignal.timeout(8000) })
      if (response.ok && response.headers.get('content-type')?.startsWith('image/')) found.push(url)
      await response.body?.cancel()
    } catch { /* optional fallback */ }
  }
  return found
}

function modes(text) {
  const light = /(?:\blight\b|亮色|浅色)/i.test(text)
  const dark = /(?:\bdark\b|暗色|深色)/i.test(text)
  if (light && !dark) return ['light']
  if (dark && !light) return ['dark']
  return ['light', 'dark']
}

function tags(text) {
  const candidates = [
    ['wallpaper', /wallpaper|壁纸|背景/i], ['glass', /glass|透明|磨砂/i], ['anime', /anime|动漫|女仆|东方|二次元/i],
    ['retro', /retro|xp|qq200|复古/i], ['pastel', /pastel|catppuccin|柔和/i], ['motion', /motion|动画|动态/i],
    ['token-theme', /token|配色|palette|主题/i], ['light-dark', /light|dark|亮色|暗色/i],
  ]
  const result = candidates.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag)
  return result.length ? result : ['appearance']
}

function safeId(value) {
  return value.toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '')
}

async function existingRegistry() {
  const entries = []
  for (const file of (await readdir(registryDir)).filter(file => file.endsWith('.yml'))) {
    entries.push({ file, value: parse(await readFile(join(registryDir, file), 'utf8')) })
  }
  return entries
}

function targetKey(target) {
  return `${target.repository.toLowerCase()}#${target.subpath ?? ''}`
}

function withoutUpdatedAt(entry) {
  const copy = structuredClone(entry)
  delete copy.updatedAt
  return copy
}

function metadataSnapshot(entry) {
  const copy = structuredClone(entry)
  delete copy.install
  delete copy.starsSnapshot
  delete copy.releaseUpdatedAt
  delete copy.metadataUpdatedAt
  delete copy.starsUpdatedAt
  delete copy.updatedAt
  return copy
}

async function inspect(plugin, existing) {
  const target = githubTarget(plugin.url)
  if (target === null) return { plugin, status: 'blocked', blockers: ['unsupported repository URL'] }
  const prior = existing.find(item => item.value.repo?.toLowerCase() === target.repository.toLowerCase() && (item.value.subpath ?? null) === target.subpath)

  const [sha, liveStars] = await Promise.all([headSha(target), repositoryStars(target)])
  plugin = { ...plugin, stars: liveStars ?? plugin.stars }
  if (sha === null) return { plugin, target, status: 'blocked', blockers: ['cannot resolve repository HEAD'] }
  const [packageText, patchText, readme, readmeZh, licenseText, commonShots] = await Promise.all([
    raw(target, sha, 'package.json'), raw(target, sha, 'cordis.patch.yml'), raw(target, sha, 'README.md'), raw(target, sha, 'README.zh.md'), raw(target, sha, 'LICENSE'), commonScreenshots(target, sha),
  ])
  const pkg = parsePackage(packageText)
  const combinedReadme = `${readme ?? ''}\n${readmeZh ?? ''}`
  const id = rowId(patchText) ?? rowId(combinedReadme)
  const detectedDshVersion = pkg ? compatibility(pkg, combinedReadme) : null
  const dshVersion = detectedDshVersion ?? (prior?.value.review?.compatibility !== 'unverified' ? prior?.value.compatibility?.dsh : null)
  const detectedLicense = typeof pkg?.license === 'string' ? pkg.license : licenseText?.startsWith('MIT License') ? 'MIT' : null
  const license = detectedLicense ?? prior?.value.license?.code ?? null
  const readmeShots = readmeScreenshots(combinedReadme, target, sha)
  const clientPath = clientEntryPath(pkg)
  const clientEntryPresent = clientPath ? await raw(target, sha, clientPath.replace(/^\.\//, '')) !== null : false
  const health = inspectSkinHealth({ pkg, rowId: id, readmeScreenshotCount: readmeShots.length, compatibility: detectedDshVersion, clientEntryPresent })
  const marketScreenshots = prior?.value.marketScreenshots ?? []
  const curatedShots = (plugin.screenshots ?? []).map(value => pinnedScreenshot(value, target, sha)).filter(Boolean)
  const discoveredScreenshots = [...new Set([...curatedShots, ...readmeShots, ...commonShots])].slice(0, 6)
  const priorVerifiedScreenshots = prior?.value.review?.preview !== 'repository-card'
    ? (prior?.value.screenshots ?? []).filter(value => !marketScreenshots.includes(value))
    : []
  const verifiedScreenshots = discoveredScreenshots.length > 0 ? discoveredScreenshots : priorVerifiedScreenshots
  const screenshots = verifiedScreenshots.length > 0
    ? verifiedScreenshots
    : marketScreenshots.length > 0 ? [] : [`https://opengraph.githubassets.com/${sha}/${target.fullName}`]
  const blockers = []
  if (!pkg?.name) blockers.push('package name missing')
  if (!pkg?.version) blockers.push('package version missing')
  if (!pkg?.dsh?.client) blockers.push('dsh.client missing')
  if (!id) blockers.push('loader row id missing')
  if (!license) blockers.push('license missing')
  if (blockers.length) return { plugin, target, sha, package: pkg ? { name: pkg.name, version: pkg.version } : null, status: 'blocked', blockers, screenshots }

  const displayName = plugin.name.split('#').pop()
  const upstreamDescription = plugin.registryOnly
    ? pkg.description
    : plugin.description?.zh ?? plugin.description?.en ?? pkg.description
  const description = typeof upstreamDescription === 'string' && upstreamDescription.trim()
    ? upstreamDescription.trim()
    : prior?.value.description
  if (!description) return { plugin, target, sha, status: 'blocked', blockers: ['description missing'] }
  const searchable = `${displayName} ${plugin.description?.en ?? ''} ${plugin.description?.zh ?? ''} ${combinedReadme.slice(0, 5000)}`
  const generated = {
    id: prior?.value.id ?? `${safeId(target.owner)}.${safeId(displayName)}`,
    name: prior?.value.name ?? { zh: displayName, en: displayName },
    author: prior?.value.author ?? target.owner,
    description,
    repo: target.repository,
    ...(target.subpath ? { subpath: target.subpath } : {}),
    package: pkg.name,
    rowId: id,
    category: prior?.value.category ?? 'theme',
    tags: prior?.value.tags ?? tags(searchable),
    modes: prior?.value.modes ?? modes(searchable),
    install: {
      target: `github:${target.fullName}#${sha}${target.subpath ? `&path:${target.subpath}` : ''}`,
      version: pkg.version,
      commit: sha,
      ...(pkg.scripts?.prepare ? { allowBuild: `${pkg.name}@https://codeload.github.com/${target.fullName}/tar.gz/${sha}` } : {}),
    },
    compatibility: { dsh: dshVersion ?? 'unverified', platform: ['web'] },
    ...(marketScreenshots.length > 0 ? { marketScreenshots } : {}),
    screenshots,
    review: {
      compatibility: dshVersion ? 'verified' : 'unverified',
      preview: marketScreenshots.length > 0 || verifiedScreenshots.length > 0 ? 'verified' : 'repository-card',
      installation: health.checks.installation === 'pass' ? 'verified' : 'manual-only',
    },
    health,
    license: {
      code: license,
      commercialUse: permitsCommercialUse(license),
      ...(prior?.value.license?.notice ? { notice: prior.value.license.notice } : {}),
    },
    featuredRank: prior?.value.featuredRank ?? 1000 + Number(plugin.stars ?? 0) * -1,
    starsSnapshot: Number(plugin.stars ?? prior?.value.starsSnapshot ?? 0),
  }
  const now = new Date().toISOString()
  const releaseChanged = prior === undefined || JSON.stringify(prior.value.install) !== JSON.stringify(generated.install)
  const metadataChanged = prior === undefined || JSON.stringify(metadataSnapshot(prior.value)) !== JSON.stringify(metadataSnapshot(generated))
  const starsChanged = prior === undefined || prior.value.starsSnapshot !== generated.starsSnapshot
  const entry = {
    ...generated,
    releaseUpdatedAt: releaseChanged ? now : prior.value.releaseUpdatedAt ?? prior.value.updatedAt,
    metadataUpdatedAt: metadataChanged ? now : prior.value.metadataUpdatedAt ?? prior.value.updatedAt,
    starsUpdatedAt: starsChanged ? now : prior.value.starsUpdatedAt ?? prior.value.updatedAt,
    updatedAt: releaseChanged || metadataChanged || starsChanged ? now : prior.value.updatedAt,
  }
  const changed = prior === undefined || JSON.stringify(withoutUpdatedAt(prior.value)) !== JSON.stringify(withoutUpdatedAt(entry))
  return { plugin, target, sha, prior, changed, starsVerified: liveStars !== null, status: 'ready', entry }
}

async function main() {
  const sourceText = await fetchText(sourceUrl)
  if (sourceText === null) throw new Error('failed to download public Awesome DSH catalog')
  const source = JSON.parse(sourceText)
  const existing = await existingRegistry()
  const githubDiscovered = [...await discoverGithubPlugins(), ...await cachedGithubPlugins()]
  const discovered = [...source.plugins.filter(plugin => {
    if (ignoredName.test(plugin.name) || irrelevantName.test(plugin.name)) return false
    return plugin.category === 'theme' || appearanceName.test(plugin.name)
  }), ...githubDiscovered]
  const selected = []
  const selectedKeys = new Set()
  for (const plugin of discovered) {
    const target = githubTarget(plugin.url)
    if (target === null || selectedKeys.has(targetKey(target))) continue
    selected.push(plugin)
    selectedKeys.add(targetKey(target))
  }
  for (const item of existing) {
    const url = `${item.value.repo}${item.value.subpath ? `/tree/HEAD/${item.value.subpath}` : ''}`
    const target = githubTarget(url)
    if (target === null || selectedKeys.has(targetKey(target))) continue
    selected.push({
      owner: item.value.author,
      name: item.value.name.en,
      url,
      category: 'theme',
      description: item.value.description,
      stars: item.value.starsSnapshot,
      screenshots: item.value.review?.preview === 'repository-card' ? [] : item.value.screenshots,
      registryOnly: true,
    })
    selectedKeys.add(targetKey(target))
  }
  selected.sort((a, b) => Number(b.stars ?? 0) - Number(a.stars ?? 0) || a.url.localeCompare(b.url))
  const results = []
  for (const plugin of selected) results.push(await inspect(plugin, existing))

  const ready = results.filter(item => item.status === 'ready')
  const usedRanks = new Set(existing.map(item => item.value.featuredRank))
  let nextRank = Math.max(0, ...usedRanks) + 1
  const usedIds = new Set(existing.map(item => item.value.id))
  const usedPackages = new Set(existing.map(item => item.value.package))
  const usedRows = new Set(existing.map(item => item.value.rowId))
  const promoted = []
  const updated = []
  for (const item of ready) {
    const entry = item.entry
    if (item.prior) {
      usedIds.delete(item.prior.value.id)
      usedPackages.delete(item.prior.value.package)
      usedRows.delete(item.prior.value.rowId)
    }
    if (usedIds.has(entry.id) || usedPackages.has(entry.package) || usedRows.has(entry.rowId)) {
      item.status = 'blocked'
      item.blockers = ['registry identity conflicts with an existing entry']
      if (item.prior) {
        usedIds.add(item.prior.value.id)
        usedPackages.add(item.prior.value.package)
        usedRows.add(item.prior.value.rowId)
      }
      continue
    }
    if (!item.prior) entry.featuredRank = nextRank++
    usedIds.add(entry.id); usedPackages.add(entry.package); usedRows.add(entry.rowId)
    const filename = item.prior?.file ?? `${item.target.owner}__${item.target.repo}${item.target.subpath ? `--${item.target.subpath.replaceAll('/', '--')}` : ''}.yml`.replace(/[^A-Za-z0-9_.-]/g, '_')
    if (!item.prior || item.changed) await writeFile(join(registryDir, filename), stringify(entry, { lineWidth: 0 }))
    if (item.prior) {
      item.status = item.changed ? 'updated' : 'unchanged'
      if (item.changed) updated.push({ id: entry.id, file: filename, repository: item.plugin.url, version: entry.install.version, commit: entry.install.commit, stars: entry.starsSnapshot })
    } else {
      item.status = 'promoted'
      promoted.push({ id: entry.id, file: filename, repository: item.plugin.url, stars: item.plugin.stars })
    }
  }

  await mkdir(outputDir, { recursive: true })
  const summary = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: sourceUrl,
    sources: [sourceUrl, 'GitHub Search API: topic:dsh-plugin'],
    githubDiscovered: githubDiscovered.length,
    sourceUpdated: source.updated,
    selected: selected.length,
    totalRegistry: existing.length + promoted.length,
    unchanged: results.filter(item => item.status === 'unchanged').length,
    updated: updated.length,
    promoted: promoted.length,
    blocked: results.filter(item => item.status === 'blocked').length,
    starsVerified: verifiedStarsRepositories.size,
    promotions: promoted,
    updates: updated,
    results,
  }
  await writeFile(join(outputDir, 'results.json'), `${JSON.stringify(summary, null, 2)}\n`)
  const blockedRows = results.filter(item => item.status === 'blocked').map(item => `| [${item.plugin.owner}/${item.plugin.name}](${item.plugin.url}) | ${item.plugin.stars ?? 0} | ${(item.blockers ?? []).join('; ')} |`)
  await writeFile(join(outputDir, 'report.md'), `# Full skin ingestion report\n\n- Candidates and registered repositories checked: ${selected.length}\n- Repositories with Stars verified directly from GitHub: ${summary.starsVerified}\n- Existing entries updated: ${summary.updated}\n- Existing entries unchanged: ${summary.unchanged}\n- Newly promoted: ${summary.promoted}\n- Total registry entries: ${summary.totalRegistry}\n- Blocked: ${summary.blocked}\n\nClient-only plugins with a verified package, DSH client manifest, loader row ID, and committed client entry can be registered automatically by the market. A missing DSH compatibility declaration is reported independently as a warning and does not by itself disable market installation. Repositories without a real screenshot use a clearly labelled repository-card fallback.\n\n## Updated\n\n${updated.map(item => `- ${item.stars} stars — [${item.id}](${item.repository}) → ${item.version} at \`${item.commit.slice(0, 12)}\``).join('\n') || '- None'}\n\n## Promoted\n\n${promoted.map(item => `- ${item.stars} stars — [${item.id}](${item.repository}) → \`${item.file}\``).join('\n') || '- None'}\n\n## Blocked\n\n| Candidate | Stars | Reason |\n|---|---:|---|\n${blockedRows.join('\n')}\n`)
  console.log(`checked ${selected.length}: ${summary.starsVerified} Stars verified, ${summary.updated} updated, ${summary.unchanged} unchanged, ${summary.promoted} promoted, ${summary.blocked} blocked`)
}

await main()
