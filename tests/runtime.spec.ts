import { describe, expect, it } from 'vitest'
import { hasRuntimeCapability, runtimeCapabilities } from '../src/runtime.ts'

describe('DSH runtime capabilities', () => {
  it('detects the keyed settings slot contract from the rc.6 line onward', () => {
    expect(runtimeCapabilities('0.1.0-rc.5')).toEqual([])
    expect(runtimeCapabilities('0.1.0-rc.6')).toContain('slot:keyed:settings.plugin.item')
    expect(runtimeCapabilities('0.1.1-rc.1')).toContain('slot:keyed:settings.plugin.item')
  })

  it('checks capabilities without coupling adapters to package names', () => {
    const capabilities = runtimeCapabilities('0.1.1-rc.1')
    expect(hasRuntimeCapability({ version: '0.1.1-rc.1', capabilities, source: 'injected' }, 'slot:keyed:settings.plugin.item')).toBe(true)
  })
})
