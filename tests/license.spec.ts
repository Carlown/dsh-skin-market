import { describe, expect, it } from 'vitest'
import { permitsCommercialUse } from '../scripts/license.mjs'

describe('license policy', () => {
  it.each(['MIT', 'BSD-3-Clause', 'Apache-2.0', 'GPL-3.0-only', 'CC-BY-SA-4.0'])(
    'recognizes %s as permitting commercial use',
    license => expect(permitsCommercialUse(license)).toBe(true),
  )

  it.each(['NOASSERTION', 'UNLICENSED', 'CC-BY-NC-SA-4.0', 'SEE LICENSE IN LICENSE.md'])(
    'does not claim commercial permission for %s',
    license => expect(permitsCommercialUse(license)).toBe(false),
  )
})
