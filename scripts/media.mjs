import { createHash } from 'node:crypto'

export const MEDIA_VERSION = 'v1'
export const MEDIA_BASE_URL = 'https://kingofsoysauce.github.io/dsh-skin-market/skin-media'

const RASTER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

export function isRasterImageUrl(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return false
  try {
    return RASTER_EXTENSIONS.has(new URL(value).pathname.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '')
  } catch {
    return false
  }
}

export function mediaKey(sourceUrl) {
  return createHash('sha256').update(sourceUrl).digest('hex').slice(0, 32)
}

export function mediaDescriptor(sourceUrl, baseUrl = MEDIA_BASE_URL) {
  if (!isRasterImageUrl(sourceUrl)) return undefined
  const base = baseUrl.replace(/\/$/, '')
  const key = mediaKey(sourceUrl)
  return {
    preview: `${base}/${MEDIA_VERSION}/${key}.preview.webp`,
    full: `${base}/${MEDIA_VERSION}/${key}.full.webp`,
  }
}

export function mediaForSources(screenshots, listScreenshot, baseUrl = MEDIA_BASE_URL) {
  const screenshotMedia = screenshots.map(source => mediaDescriptor(source, baseUrl) ?? null)
  const list = listScreenshot === undefined ? undefined : mediaDescriptor(listScreenshot, baseUrl)
  if (list === undefined && screenshotMedia.every(item => item === null)) return undefined
  return {
    ...(list === undefined ? {} : { list }),
    screenshots: screenshotMedia,
  }
}
