import { describe, expect, it } from 'vitest'
import { comparePublicCatalogOrder, shouldRenderPublicPreview, type PublicCatalogEntry } from '../site/catalog-order.ts'

const previewed = {
  review: { preview: 'verified' as const },
  screenshots: ['preview.png'],
  starsSnapshot: 1,
  updatedAt: '2026-08-17T00:00:00Z',
} satisfies PublicCatalogEntry

describe('public catalog order', () => {
  it('renders market-supplemented previews even when the upstream preview is a repository card', () => {
    const supplemented = {
      ...previewed,
      review: { preview: 'repository-card' as const },
      marketScreenshots: ['market-preview.png'],
    }

    expect(shouldRenderPublicPreview(supplemented, supplemented.marketScreenshots[0])).toBe(true)
    expect(shouldRenderPublicPreview({ ...supplemented, marketScreenshots: [] }, 'repository-card.png')).toBe(false)
    expect(shouldRenderPublicPreview(supplemented, supplemented.marketScreenshots[0], true)).toBe(false)
  })

  it('keeps entries without a usable preview last before applying the selected sort', () => {
    const placeholder = {
      ...previewed,
      review: { preview: 'repository-card' as const },
      starsSnapshot: 999,
    }

    expect([placeholder, previewed].sort((a, b) => comparePublicCatalogOrder(a, b, 'stars'))).toEqual([
      previewed,
      placeholder,
    ])
  })

  it('treats market-supplemented screenshots as real previews', () => {
    const supplemented = {
      ...previewed,
      review: { preview: 'repository-card' as const },
      marketScreenshots: ['market-preview.png'],
    }
    const placeholder = {
      ...previewed,
      review: { preview: 'repository-card' as const },
      starsSnapshot: 999,
    }

    expect([placeholder, supplemented].sort((a, b) => comparePublicCatalogOrder(a, b, 'stars'))).toEqual([
      supplemented,
      placeholder,
    ])
  })
})
