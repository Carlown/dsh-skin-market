import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const README_STATS_START = '<!-- DSH_SKIN_MARKET_AUTO_STATS:START -->'
const README_STATS_END = '<!-- DSH_SKIN_MARKET_AUTO_STATS:END -->'
const RECENT_START = '<!-- DSH_SKIN_MARKET_AUTO_RECENT:START -->'
const RECENT_END = '<!-- DSH_SKIN_MARKET_AUTO_RECENT:END -->'

function replaceMarkedBlock(source, start, end, block) {
  const escapedStart = start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedEnd = end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}`)
  return pattern.test(source) ? source.replace(pattern, block) : null
}

function repoLabel(repo) {
  return repo.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '')
}

function formatDate(value) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : parsed.toISOString().slice(0, 10)
}

function entryBlock(entry) {
  const description = entry.description.replace(/\s+/g, ' ').trim()
  return `<!-- dsh-auto-entry:${entry.id} -->\n### ${formatDate(entry.updatedAt)} · ${entry.name.zh}\n\n[${repoLabel(entry.repo)}](${entry.repo})：${description}\n\n- 版本：\`${entry.install.version}\`\n- 固定 commit：\`${entry.install.commit}\``
}

function autoEntries(source) {
  return source.match(/<!-- dsh-auto-entry:[^\n]+ -->[\s\S]*?(?=<!-- dsh-auto-entry:|$)/g) ?? []
}

function updateReadme(source, catalogCount, syncAt) {
  const block = `${README_STATS_START}\n当前在线目录收录 **${catalogCount} 款**社区皮肤。\n\n最近一次自动同步：${syncAt}。自动任务会同步 registry、catalog、项目 README 和近期收录日志。\n${README_STATS_END}`
  const replaced = replaceMarkedBlock(source, README_STATS_START, README_STATS_END, block)
  if (replaced !== null) return replaced
  const anchor = '查看[近期收录日志](./docs/recently-added.md)'
  const inserted = source.replace(anchor, `${anchor}\n\n${block}`)
  return inserted === source ? `${source.trimEnd()}\n\n${block}\n` : inserted
}

function updateRecentlyAdded(source, changes) {
  if (changes.length === 0) return source
  const fresh = changes
    .slice()
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .map(entryBlock)
  const existingBlock = source.match(new RegExp(`${RECENT_START}\\n([\\s\\S]*?)\\n${RECENT_END}`))?.[1] ?? '## 自动同步更新\n'
  const entries = []
  const seen = new Set()
  for (const entry of [...fresh, ...autoEntries(existingBlock)]) {
    const id = /<!-- dsh-auto-entry:([^\n]+) -->/.exec(entry)?.[1]
    if (id === undefined || seen.has(id)) continue
    seen.add(id)
    entries.push(entry)
  }
  const block = `${RECENT_START}\n## 自动同步更新\n\n${entries.slice(0, 30).join('\n\n')}\n${RECENT_END}`
  const replaced = replaceMarkedBlock(source, RECENT_START, RECENT_END, block)
  if (replaced !== null) return replaced
  const firstSection = source.search(/^##\s+/m)
  return firstSection >= 0
    ? `${source.slice(0, firstSection)}${block}\n\n${source.slice(firstSection)}`
    : `${source.trimEnd()}\n\n${block}\n`
}

export async function updateProjectDocs({ root, catalogCount, syncAt, changes }) {
  const readmePath = join(root, 'README.md')
  const recentPath = join(root, 'docs/recently-added.md')
  const readme = await readFile(readmePath, 'utf8')
  const recent = await readFile(recentPath, 'utf8')
  await writeFile(readmePath, updateReadme(readme, catalogCount, syncAt))
  if (changes.length > 0) await writeFile(recentPath, updateRecentlyAdded(recent, changes))
}
