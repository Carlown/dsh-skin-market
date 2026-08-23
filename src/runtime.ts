import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { satisfiesVersionRange } from './semver.ts'
import type { DshRuntime } from './types.ts'

export const KEYED_SLOT_CAPABILITY_PREFIX = 'slot:keyed:'

function packageVersion(file: string): string | null {
  try {
    const value = JSON.parse(readFileSync(file, 'utf8')) as { version?: unknown }
    return typeof value.version === 'string' ? value.version : null
  } catch {
    return null
  }
}

function dshPackageFile(): string | null {
  const explicit = process.env.DSH_VERSION?.trim()
  if (explicit !== undefined && explicit !== '') return null
  const entry = process.argv[1]
  if (entry === undefined) return null
  let directory: string
  try { directory = dirname(realpathSync(resolve(entry))) } catch { directory = dirname(resolve(entry)) }
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = join(directory, 'package.json')
    if (existsSync(candidate)) return candidate
    const parent = dirname(directory)
    if (parent === directory) break
    directory = parent
  }
  return null
}

export function runtimeCapabilities(version: string | null): string[] {
  if (version === null) return []
  const capabilities: string[] = []
  // DSH changed this slot from a list to a keyed slot in the rc.6 line.
  if (satisfiesVersionRange(version, '>=0.1.0-rc.6 <0.2.0-0')) {
    capabilities.push(`${KEYED_SLOT_CAPABILITY_PREFIX}settings.plugin.item`)
  }
  return capabilities
}

export function detectDshRuntime(): DshRuntime {
  const injected = process.env.DSH_VERSION?.trim()
  if (injected !== undefined && injected !== '') {
    return { version: injected, capabilities: runtimeCapabilities(injected), source: 'injected' }
  }
  const packageFile = dshPackageFile()
  const version = packageFile === null ? null : packageVersion(packageFile)
  return { version, capabilities: runtimeCapabilities(version), source: version === null ? 'unknown' : 'host-package' }
}

export function hasRuntimeCapability(runtime: DshRuntime, capability: string): boolean {
  return runtime.capabilities.includes(capability)
}
