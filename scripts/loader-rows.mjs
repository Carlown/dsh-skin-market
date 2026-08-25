import { parse } from 'yaml'

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function identity(value) {
  if (!isRecord(value)) return null
  const id = typeof value.id === 'string' && value.id.length > 0 ? value.id : undefined
  const name = typeof value.name === 'string' && value.name.length > 0 ? value.name : undefined
  return id === undefined && name === undefined ? null : { id, name }
}

export function parseInsertedLoaderRows(patchText) {
  if (typeof patchText !== 'string') return []
  let document
  try { document = parse(patchText) } catch { return [] }
  if (!Array.isArray(document)) return []
  const rows = []
  const visit = value => {
    if (!isRecord(value) || !Array.isArray(value.insert)) return
    for (const child of value.insert) {
      const row = identity(child)
      if (row !== null) rows.push(row)
      visit(child)
    }
  }
  for (const operation of document) visit(operation)
  return rows
}

export function primaryLoaderIdFromPatch(patchText, packageName) {
  const rows = parseInsertedLoaderRows(patchText)
  if (typeof packageName !== 'string' || packageName.length === 0) return { id: null, reason: 'package name missing' }
  const candidates = rows.filter(row => row.name === packageName)
  if (candidates.length === 0) return { id: null, reason: `bundle patch has no loader named ${packageName}` }
  if (candidates.length > 1) return { id: null, reason: `bundle patch has multiple loaders named ${packageName}` }
  if (candidates[0].id === undefined) return { id: null, reason: `loader named ${packageName} has no id` }
  return { id: candidates[0].id, reason: null }
}
