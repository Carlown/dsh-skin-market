import { readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv from 'ajv/dist/2020.js'
import { parse } from 'yaml'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const schema = JSON.parse(await readFile(join(root, 'registry/skin.schema.json'), 'utf8'))
const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false })
const validate = ajv.compile(schema)
const sourceDir = join(root, 'registry/skins')
const files = (await readdir(sourceDir)).filter(file => file.endsWith('.yml')).sort()
const skins = []

for (const file of files) {
  const skin = parse(await readFile(join(sourceDir, file), 'utf8'))
  if (!validate(skin)) {
    const details = (validate.errors ?? []).map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')
    throw new Error(`${file}: ${details}`)
  }
  const repo = skin.repo.replace(/^https:\/\/github\.com\//, '').replace(/\/$/, '')
  const expected = `github:${repo}#${skin.install.commit}${skin.subpath ? `&path:${skin.subpath}` : ''}`
  if (skin.install.target !== expected) throw new Error(`${file}: install.target must equal ${expected}`)
  skins.push(skin)
}

const ids = new Set()
const packages = new Set()
const rows = new Set()
for (const skin of skins) {
  for (const [label, value, set] of [['id', skin.id, ids], ['package', skin.package, packages], ['rowId', skin.rowId, rows]]) {
    if (set.has(value)) throw new Error(`duplicate ${label}: ${value}`)
    set.add(value)
  }
}

const catalogPath = join(root, 'data/catalog.json')
const sortedSkins = skins.sort((a, b) => a.featuredRank - b.featuredRank)
let generatedAt = new Date().toISOString()
try {
  const previous = JSON.parse(await readFile(catalogPath, 'utf8'))
  if (JSON.stringify(previous.skins) === JSON.stringify(sortedSkins) && typeof previous.generatedAt === 'string') {
    generatedAt = previous.generatedAt
  }
} catch { /* first build */ }

const catalog = {
  schemaVersion: 1,
  generatedAt,
  skins: sortedSkins,
}
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`)
console.log(`validated ${skins.length} skins`)
