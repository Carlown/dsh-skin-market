import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, stringify } from 'yaml'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const registryDir = join(root, 'registry', 'skins')
const reportPath = join(root, '.preview', 'skin-screenshots', 'report.json')
const publicRoot = join(root, 'site', 'public', 'skin-screenshots')
const publicBase = 'https://kingofsoysauce.github.io/dsh-skin-market/skin-screenshots'

function usage() {
  console.log(`Usage: node scripts/promote-skin-screenshots.mjs --skin <id> --yes-reviewed

Promotes the three visually reviewed local captures into the hosted site and
adds them as marketScreenshots. Catalog builds prepend them; upstream images
remain in their original order after them.`)
}

const args = process.argv.slice(2)
if (args.includes('--help')) { usage(); process.exit(0) }
const skinIndex = args.indexOf('--skin')
const skinId = skinIndex >= 0 ? args[skinIndex + 1] : undefined
if (!skinId || !args.includes('--yes-reviewed')) {
  usage()
  throw new Error('promotion requires --skin <id> and explicit --yes-reviewed confirmation')
}

const report = JSON.parse(await readFile(reportPath, 'utf8'))
const captured = report.screenshots.find(item => item.id === skinId)
if (!captured) throw new Error(`${skinId}: not found in ${relative(root, reportPath)}`)
if (captured.conversation?.externalModelRequestSent !== false || captured.conversation?.tokenSpend !== 0 || captured.conversation?.historyReopened !== true) {
  throw new Error(`${skinId}: conversation capture is not certified zero-token`)
}

let registryFile
let entry
for (const filename of await readdir(registryDir)) {
  if (!filename.endsWith('.yml')) continue
  const file = join(registryDir, filename)
  const value = parse(await readFile(file, 'utf8'))
  if (value.id === skinId) { registryFile = file; entry = value; break }
}
if (!registryFile || !entry) throw new Error(`${skinId}: registry entry not found`)
if (entry.install?.commit !== captured.commit) throw new Error(`${skinId}: capture commit does not match registry pin`)

const slug = `${captured.owner}__${captured.repo}`
const destination = join(publicRoot, slug, captured.commit)
await mkdir(destination, { recursive: true })
const viewOrder = ['home', 'conversation', 'settings']
const urls = []
for (const view of viewOrder) {
  const source = resolve(root, captured.screenshots[view])
  const target = join(destination, `${view}.png`)
  await copyFile(source, target)
  urls.push(`${publicBase}/${slug}/${captured.commit}/${view}.png`)
}

entry.marketScreenshots = urls
entry.screenshots = (entry.screenshots ?? []).filter(url => !url.startsWith('https://opengraph.githubassets.com/'))
entry.review = { ...entry.review, preview: 'verified' }
const now = new Date().toISOString()
entry.metadataUpdatedAt = now
entry.updatedAt = now
await writeFile(registryFile, stringify(entry, { lineWidth: 0 }))

console.log(`Promoted ${urls.length} reviewed screenshot(s) for ${skinId}`)
console.log(`Registry: ${relative(root, registryFile)}`)
console.log('Removal contract: delete marketScreenshots in a market PR; upstream screenshots are preserved.')
