import { describe, expect, it } from 'vitest'
import { compareVersions, isVersionRange, satisfiesVersionRange } from '../src/semver.ts'

describe('compatibility semver ranges', () => {
  it('supports prerelease comparator sets and alternatives', () => {
    expect(satisfiesVersionRange('0.1.1-rc.1', '>=0.1.0-rc.6 <0.2.0-0')).toBe(true)
    expect(satisfiesVersionRange('0.1.0-rc.5', '>=0.1.0-rc.6 <0.2.0-0')).toBe(false)
    expect(satisfiesVersionRange('0.1.1-rc.1', '>=0.1.0-rc.1 <0.1.1 || >=0.1.1-rc.1 <0.2.0-0')).toBe(true)
  })

  it('accepts catalog ranges and the unverified marker', () => {
    expect(isVersionRange('^0.1.0-rc.5')).toBe(true)
    expect(isVersionRange('unverified')).toBe(true)
    expect(isVersionRange('not a version range')).toBe(false)
  })

  it('keeps prerelease ordering stable', () => {
    expect(compareVersions('0.1.0-rc.7', '0.1.0-rc.6')).toBeGreaterThan(0)
    expect(compareVersions('0.1.0', '0.1.0-rc.7')).toBeGreaterThan(0)
  })
})
