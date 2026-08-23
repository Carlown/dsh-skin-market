import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { compatibilityPatchFile, ensurePatchedDependency, packageDir, packageManifest } from './profile.ts'
import { hasRuntimeCapability, KEYED_SLOT_CAPABILITY_PREFIX } from './runtime.ts'
import { satisfiesVersionRange } from './semver.ts'
import type { CompatibilityAdapter, DshRuntime, SkinEntry } from './types.ts'

export interface CompatibilityPatchPlan {
  patchFile: string
  patchRelativePath: string
  packageName: string
  packageVersion: string
  originalSource: string
  patchedSource: string
  relativeSourcePath: string
  adapterIds: string[]
  matchedAdapterIds: string[]
}

export type CompatibilityDecision = 'compatible' | 'adaptable' | 'unknown' | 'incompatible'

export interface CompatibilityAssessment {
  decision: CompatibilityDecision
  reason: string
  adapterIds: string[]
}

interface TextEdit { start: number; end: number; value: string }
interface AdapterTransformResult { source: string; count: number; matched: boolean }

const DEFAULT_ADAPTER: CompatibilityAdapter = {
  id: 'builtin-keyed-settings-plugin-item',
  kind: 'keyed-slot-id-to-key',
  when: '>=0.1.0-rc.6 <0.2.0-0',
  slot: 'settings.plugin.item',
  key: 'locale',
}

function exportedPath(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  for (const key of ['default', 'import', 'require', 'node']) {
    if (typeof record[key] === 'string') return record[key] as string
  }
  return null
}

function clientEntryPath(manifest: Record<string, unknown>): string | null {
  const exports = manifest.exports
  if (typeof exports !== 'object' || exports === null || Array.isArray(exports)) return null
  return exportedPath((exports as Record<string, unknown>)['./client'])
}

function findObjectEnd(source: string, open: number): number | null {
  let depth = 0
  let quote: string | null = null
  let escaped = false
  let lineComment = false
  let blockComment = false
  for (let index = open; index < source.length; index += 1) {
    const char = source[index]!
    const next = source[index + 1]
    if (lineComment) {
      if (char === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }
    if (quote !== null) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = null
      continue
    }
    if (char === '/' && next === '/') {
      lineComment = true
      index += 1
      continue
    }
    if (char === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }
    if (char === '{') depth += 1
    if (char === '}' && --depth === 0) return index
  }
  return null
}

function property(source: string, name: string): { start: number; end: number; value: string } | null {
  const match = new RegExp(`(^|[,\\n])(\\s*)${name}\\s*:\\s*([^,\\n}]+)`, 'm').exec(source)
  if (match === null || match.index === undefined) return null
  const prefixLength = match[1]!.length
  return {
    start: match.index + prefixLength,
    end: match.index + match[0].length,
    value: match[3]!.trim(),
  }
}

function stringProperty(source: string, name: string): string | null {
  const match = new RegExp(`(?:^|[,\\n])\\s*${name}\\s*:\\s*(["'])([^"']+)\\1`, 'm').exec(source)
  return match?.[2] ?? null
}

function settingsNamespaceExpression(source: string, locale: { value: string } | null): string | null {
  if (locale === null) return null
  if (/^["']settings\.[^"']+["']$/.test(locale.value)) return locale.value
  if (!/^[A-Za-z_$][\w$]*$/.test(locale.value)) return null
  const declaration = new RegExp(`(?:const|let|var)\\s+${locale.value}\\s*=\\s*(["']settings\\.[^"']+["'])`).exec(source)
  return declaration?.[1] ?? null
}

function transformKeyedSlot(source: string, adapter: CompatibilityAdapter): AdapterTransformResult {
  const edits: TextEdit[] = []
  let matched = false
  const register = /\.register\(\s*\{/g
  for (const match of source.matchAll(register)) {
    const open = (match.index ?? 0) + match[0].lastIndexOf('{')
    const close = findObjectEnd(source, open)
    if (close === null) continue
    const object = source.slice(open + 1, close)
    if (stringProperty(object, 'name') !== adapter.slot) continue
    matched = true
    if (property(object, 'key') !== null) continue
    const id = property(object, 'id')
    if (id === null) continue
    const locale = property(object, 'locale')
    const expression = adapter.key === 'locale'
      ? settingsNamespaceExpression(source, locale)
      : JSON.stringify(adapter.key)
    if (expression === undefined || expression === null || expression === '') continue
    const propertyStart = open + 1 + id.start
    const propertyEnd = open + 1 + id.end
    const original = source.slice(propertyStart, propertyEnd)
    const indent = /^\s*/.exec(original)?.[0] ?? ''
    edits.push({ start: propertyStart, end: propertyEnd, value: `${indent}key: ${expression}` })
  }
  if (edits.length === 0) return { source, count: 0, matched }
  let result = source
  for (const edit of edits.sort((a, b) => b.start - a.start)) result = `${result.slice(0, edit.start)}${edit.value}${result.slice(edit.end)}`
  return { source: result, count: edits.length, matched: true }
}

function applyAdapter(source: string, adapter: CompatibilityAdapter): AdapterTransformResult {
  if (adapter.kind === 'keyed-slot-id-to-key') return transformKeyedSlot(source, adapter)
  return { source, count: 0, matched: false }
}

function declaredAdapters(skin: SkinEntry): CompatibilityAdapter[] {
  return skin.compatibility.adapters ?? []
}

function sameAdapter(left: CompatibilityAdapter, right: CompatibilityAdapter): boolean {
  return left.kind === right.kind
    && left.when === right.when
    && left.slot === right.slot
    && left.key === right.key
}

function applicableAdapters(skin: SkinEntry, runtime: DshRuntime, includeBuiltIns: boolean): CompatibilityAdapter[] {
  if (runtime.version === null) return []
  const declared = declaredAdapters(skin)
  const adapters = includeBuiltIns
    ? [...declared, DEFAULT_ADAPTER].filter((adapter, index, all) => all.findIndex(item => sameAdapter(item, adapter)) === index)
    : declared
  return adapters.filter(adapter =>
    satisfiesVersionRange(runtime.version!, adapter.when)
    && hasRuntimeCapability(runtime, `${KEYED_SLOT_CAPABILITY_PREFIX}${adapter.slot}`),
  )
}

export function assessCompatibility(skin: SkinEntry, runtime: DshRuntime): CompatibilityAssessment {
  if (runtime.version === null) return {
    decision: 'unknown',
    reason: '无法读取当前 DSH 版本，保留安装流程但不会自动应用兼容补丁',
    adapterIds: [],
  }
  // Declared adapters are safe to advertise before downloading a package.
  // Built-ins are deliberately applied optimistically only after the package
  // has materialized, where the source can be inspected.
  const adapters = applicableAdapters(skin, runtime, false)
  if (skin.compatibility.dsh === 'unverified') return {
    decision: 'unknown',
    reason: `皮肤未声明 DSH 兼容范围（当前 ${runtime.version}）`,
    adapterIds: adapters.map(adapter => adapter.id),
  }
  if (adapters.length > 0) return {
    decision: 'adaptable',
    reason: `当前 DSH ${runtime.version} 命中可选兼容适配器`,
    adapterIds: adapters.map(adapter => adapter.id),
  }
  if (satisfiesVersionRange(runtime.version, skin.compatibility.dsh)) return {
    decision: 'compatible',
    reason: `当前 DSH ${runtime.version} 在声明范围 ${skin.compatibility.dsh} 内`,
    adapterIds: adapters.map(adapter => adapter.id),
  }
  return {
    decision: 'incompatible',
    reason: `当前 DSH ${runtime.version} 不在皮肤声明的兼容范围 ${skin.compatibility.dsh} 内，且没有可用适配器`,
    adapterIds: [],
  }
}

export function planCompatibilityPatch(profileDir: string, skin: SkinEntry, runtime: DshRuntime): CompatibilityPatchPlan | null {
  if (runtime.version === null) return null
  const adapters = applicableAdapters(skin, runtime, true)
  if (adapters.length === 0) return null
  const declared = applicableAdapters(skin, runtime, false)
  const manifest = packageManifest(profileDir, skin.package)
  if (manifest === null) {
    if (declared.length > 0) throw new Error('无法读取已安装包的清单，不能应用声明的兼容适配')
    return null
  }
  const entry = clientEntryPath(manifest)
  if (entry === null || !entry.startsWith('./')) {
    if (declared.length > 0) throw new Error('已安装包未提供可适配的 ./client 导出')
    return null
  }
  const packageRoot = packageDir(profileDir, skin.package)
  const sourceFile = resolve(packageRoot, entry)
  if (!sourceFile.startsWith(resolve(packageRoot) + sep) || !existsSync(sourceFile)) {
    if (declared.length > 0) throw new Error('已安装包的客户端源码不存在，不能应用声明的兼容适配')
    return null
  }
  const originalSource = readFileSync(sourceFile, 'utf8')
  let patchedSource = originalSource
  const adapterIds: string[] = []
  const matchedAdapterIds: string[] = []
  for (const adapter of adapters) {
    const result = applyAdapter(patchedSource, adapter)
    if (result.matched) matchedAdapterIds.push(adapter.id)
    if (result.count > 0) {
      patchedSource = result.source
      adapterIds.push(adapter.id)
    }
  }
  if (patchedSource === originalSource && matchedAdapterIds.length === 0) return null
  const version = typeof manifest.version === 'string' ? manifest.version : skin.install.version
  const patchFile = compatibilityPatchFile(profileDir, skin.package, version)
  const patchRelativePath = relative(profileDir, patchFile).split(sep).join('/')
  return {
    patchFile,
    patchRelativePath,
    packageName: skin.package,
    packageVersion: version,
    originalSource,
    patchedSource,
    relativeSourcePath: relative(packageRoot, sourceFile).split(sep).join('/'),
    adapterIds,
    matchedAdapterIds,
  }
}

export function unifiedPatch(relativeSourcePath: string, original: string, patched: string): string {
  const oldLines = original.split(/\r?\n/)
  const newLines = patched.split(/\r?\n/)
  if (oldLines.length !== newLines.length) throw new Error(`compatibility adapter changed line count for ${relativeSourcePath}`)
  const changed = oldLines.flatMap((line, index) => line === newLines[index] ? [] : [index])
  if (changed.length === 0) return ''
  const start = Math.max(0, changed[0]! - 3)
  const end = Math.min(oldLines.length - 1, changed.at(-1)! + 3)
  const hunk = [`@@ -${start + 1},${end - start + 1} +${start + 1},${end - start + 1} @@`]
  for (let index = start; index <= end; index += 1) {
    if (oldLines[index] === newLines[index]) hunk.push(` ${oldLines[index]}`)
    else {
      hunk.push(`-${oldLines[index]}`)
      hunk.push(`+${newLines[index]}`)
    }
  }
  return [`diff --git a/${relativeSourcePath} b/${relativeSourcePath}`, `--- a/${relativeSourcePath}`, `+++ b/${relativeSourcePath}`, ...hunk, ''].join('\n')
}

export function persistCompatibilityPatch(profileDir: string, plan: CompatibilityPatchPlan): void {
  const patch = unifiedPatch(plan.relativeSourcePath, plan.originalSource, plan.patchedSource)
  if (patch === '') return
  mkdirSync(dirname(plan.patchFile), { recursive: true })
  if (existsSync(plan.patchFile) && readFileSync(plan.patchFile, 'utf8') !== patch) {
    throw new Error(`compatibility patch already exists with different content for ${plan.packageName}@${plan.packageVersion}`)
  }
  if (!existsSync(plan.patchFile)) writeFileSync(plan.patchFile, patch)
  ensurePatchedDependency(profileDir, plan.packageName, plan.packageVersion, plan.patchRelativePath)
}
