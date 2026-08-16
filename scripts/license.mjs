export function permitsCommercialUse(license) {
  if (!license || /NOASSERTION|UNLICENSED|PROPRIETARY|SEE LICENSE/i.test(license)) return false
  if (/(?:^|-)NC(?:-|$)|NON.?COMMERCIAL/i.test(license)) return false
  return /MIT|BSD|APACHE|ISC|GPL|LGPL|AGPL|MPL|EPL|CDDL|UNLICENSE|CC0|CC-BY|ZLIB|BSL|ARTISTIC|OFL/i.test(license)
}
