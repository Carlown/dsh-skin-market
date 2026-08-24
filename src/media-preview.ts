import { getCatalogListScreenshot, getCatalogScreenshotUrls, type PreviewableCatalogEntry } from './catalog-order.ts'

const DEFAULT_MEDIA_BASE_URL = 'https://kingofsoysauce.github.io/dsh-skin-market/skin-media'
const MEDIA_VERSION = 'v1'

export interface GeneratedImageMedia {
  preview: string
  full: string
}

export interface GeneratedMediaEntry extends PreviewableCatalogEntry {
  media?: {
    list?: GeneratedImageMedia
    screenshots: Array<GeneratedImageMedia | null>
  }
}

function currentSearchParams(): URLSearchParams | undefined {
  const location = (globalThis as { location?: { search?: string } }).location
  return location === undefined ? undefined : new URLSearchParams(location.search ?? '')
}

let localGeneratedMediaSources: Set<string> | undefined

export function hasGeneratedMediaBase(): boolean {
  return generatedMediaBase() !== undefined
}

export function setGeneratedMediaSources(sources: Iterable<string> | undefined): void {
  localGeneratedMediaSources = sources === undefined ? undefined : new Set(sources)
}

export function parseGeneratedMediaManifest(value: unknown): string[] | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const entries = Object.entries(value)
  if (!entries.every(([source, digest]) => /^https?:\/\//i.test(source) && typeof digest === 'string')) return undefined
  return entries.map(([source]) => source)
}

export function generatedMediaEnabled(): boolean {
  const params = currentSearchParams()
  return params?.get('dsh-media') !== '0'
}

function generatedMediaBase(): string | undefined {
  const explicit = currentSearchParams()?.get('dsh-media-base')
  return explicit === null ? undefined : explicit
}

export function generatedMediaManifestUrl(): string {
  const base = generatedMediaBase()
  if (base === undefined) return `${DEFAULT_MEDIA_BASE_URL}/${MEDIA_VERSION}/manifest.json`
  try {
    return new URL('manifest.json', base.endsWith('/') ? base : `${base}/`).toString()
  } catch {
    return `${DEFAULT_MEDIA_BASE_URL}/${MEDIA_VERSION}/manifest.json`
  }
}

export function previewSourceCandidates(source: string | undefined, fallbacks: readonly string[] = []): string[] {
  return [...new Set([source, ...fallbacks].filter((item): item is string => typeof item === 'string' && item !== ''))]
}

/**
 * An explicit base is available only for testing an alternate media host.
 */
export function generatedMediaUrl(url: string): string {
  const base = generatedMediaBase()
  if (base === undefined || base === null) return url
  try {
    const filename = new URL(url).pathname.split('/').pop()
    return filename === undefined ? url : new URL(filename, base.endsWith('/') ? base : `${base}/`).toString()
  } catch {
    return url
  }
}

export function generatedMediaFor(entry: GeneratedMediaEntry, source: string | undefined, kind: 'list' | 'avatar' | 'hero' | 'gallery' | 'thumbnail' | 'recommendation' | 'card'): GeneratedImageMedia | undefined {
  if (!generatedMediaEnabled() || source === undefined || entry.media === undefined) return undefined
  if (localGeneratedMediaSources !== undefined && !localGeneratedMediaSources.has(source)) return undefined
  if ((kind === 'list' || kind === 'avatar' || kind === 'recommendation' || kind === 'card') && source === getCatalogListScreenshot(entry)) return entry.media.list
  const index = getCatalogScreenshotUrls(entry).indexOf(source)
  return index >= 0 ? entry.media.screenshots[index] ?? undefined : undefined
}

export function generatedMediaListFor(entry: GeneratedMediaEntry): GeneratedImageMedia | undefined {
  return generatedMediaFor(entry, getCatalogListScreenshot(entry), 'list')
}
