import { existsSync, readFileSync } from 'node:fs'
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
  const absolute = resolve(entry)
  const candidates = [
    join(dirname(absolute), '..', 'package.json'),
    join(dirname(absolute), 'package.json'),
  ]
  return candidates.find(file => existsSync(file)) ?? null
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
