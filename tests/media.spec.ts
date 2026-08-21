import { describe, expect, it } from 'vitest'
import { mediaDescriptor, mediaForSources, mediaKey } from '../scripts/media.mjs'

describe('generated skin media', () => {
  it('derives stable preview/full WebP URLs from raster source URLs', () => {
    const source = 'https://raw.githubusercontent.com/example/skin/abc/docs/preview.png'
    const media = mediaDescriptor(source)
    expect(media?.preview).toBe(`https://kingofsoysauce.github.io/dsh-skin-market/skin-media/v1/${mediaKey(source)}.preview.webp`)
    expect(media?.full).toBe(`https://kingofsoysauce.github.io/dsh-skin-market/skin-media/v1/${mediaKey(source)}.full.webp`)
    expect(mediaDescriptor('https://example.com/preview.gif')).toBeUndefined()
  })

  it('preserves screenshot order and marks unsupported formats as null', () => {
    const media = mediaForSources([
      'https://example.com/one.png',
      'https://example.com/animated.gif',
      'https://example.com/two.webp',
    ], 'https://example.com/one.png')
    expect(media?.list).toEqual(media?.screenshots[0])
    expect(media?.screenshots[1]).toBeNull()
    expect(media?.screenshots[2]?.full).toContain('.full.webp')
  })
})
