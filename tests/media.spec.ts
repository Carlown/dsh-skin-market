import { afterEach, describe, expect, it } from 'vitest'
import { inspectMedia } from '../scripts/check-media.mjs'
import { mediaDescriptor, mediaForSources, mediaKey, removeMediaManifestEntry, retainMediaManifestEntries } from '../scripts/media.mjs'
import { generatedMediaFor, parseGeneratedMediaManifest, previewSourceCandidates, setGeneratedMediaSources } from '../src/media-preview.ts'

describe('generated skin media', () => {
  afterEach(() => setGeneratedMediaSources(undefined))

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

  it('uses the source allowlist to bypass missing generated media', () => {
    const source = 'https://example.com/one.png'
    const entry = { screenshots: [source], media: mediaForSources([source], source) }
    setGeneratedMediaSources([])

    expect(generatedMediaFor(entry, source, 'card')).toBeUndefined()
    expect(parseGeneratedMediaManifest({ [source]: 'digest' })).toEqual([source])
    expect(parseGeneratedMediaManifest({ skins: [] })).toBeUndefined()
  })

  it('keeps Aurora cards on raw screenshots until a later available screenshot', () => {
    const first = 'https://raw.githubusercontent.com/CAPTAIN1275/dsh-ui-web/251119cedac66dbd31ca8ce6cb112369b60b359b/packages/skins/aurora/preview/dark.png'
    const second = 'https://raw.githubusercontent.com/CAPTAIN1275/dsh-ui-web/251119cedac66dbd31ca8ce6cb112369b60b359b/packages/skins/aurora/preview/light.png'
    const third = 'https://raw.githubusercontent.com/CAPTAIN1275/dsh-ui-web/4a275b080cb6ff1a1a7a91a77e08aad6ad1eab56/packages/skins/aurora/preview/dark.png'
    expect(mediaKey(first)).toBe('42d6495bef7594ba6ad53e188a809d08')
    expect(mediaKey(second)).toBe('fa5df90fd6f8922e32a255f53a8f616f')
    const entry = { screenshots: [first, second, third], media: mediaForSources([first, second, third], first) }
    setGeneratedMediaSources([third])

    expect(generatedMediaFor(entry, first, 'card')).toBeUndefined()
    expect(generatedMediaFor(entry, second, 'card')).toBeUndefined()
    expect(generatedMediaFor(entry, third, 'card')).toEqual(entry.media?.screenshots[2])
  })

  it('keeps the primary screenshot first and appends unique card fallbacks', () => {
    expect(previewSourceCandidates('one.png', ['one.png', 'two.png', 'three.png'])).toEqual(['one.png', 'two.png', 'three.png'])
  })

  it('removes failed and stale sources from a media manifest', () => {
    const first = 'https://example.com/one.png'
    const second = 'https://example.com/two.png'
    const manifest = { [first]: 'one', [second]: 'two', 'https://example.com/stale.png': 'stale' }
    expect(retainMediaManifestEntries(manifest, [first, second])).toEqual({ [first]: 'one', [second]: 'two' })
    expect(removeMediaManifestEntry(manifest, second)).toEqual({ [first]: 'one', 'https://example.com/stale.png': 'stale' })
  })

  it('reports missing catalog files and manifest entries without changing catalog data', () => {
    const source = 'https://example.com/one.png'
    const report = inspectMedia({ skins: [{ id: 'demo', screenshots: [source] }] }, {}, '/private/tmp/dsh-media-test-does-not-exist')
    expect(report.missingManifestSources).toEqual([source])
    expect(report.missingFiles).toHaveLength(2)
    expect(report.ok).toBe(false)
  })
})
