export interface SemverParts {
  core: [number, number, number]
  prerelease: string[]
}

export function parseVersion(value: string): SemverParts | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value.trim())
  if (match === null) return null
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4]?.split('.') ?? [],
  }
}

export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left)
  const b = parseVersion(right)
  if (a === null || b === null) return left.localeCompare(right)
  for (let index = 0; index < 3; index += 1) {
    if (a.core[index] !== b.core[index]) return a.core[index] - b.core[index]
  }
  if (a.prerelease.length === 0 || b.prerelease.length === 0) {
    return a.prerelease.length === b.prerelease.length ? 0 : a.prerelease.length === 0 ? 1 : -1
  }
  const length = Math.max(a.prerelease.length, b.prerelease.length)
  for (let index = 0; index < length; index += 1) {
    const x = a.prerelease[index]
    const y = b.prerelease[index]
    if (x === undefined || y === undefined) return x === y ? 0 : x === undefined ? -1 : 1
    if (x === y) continue
    const xNumber = /^\d+$/.test(x)
    const yNumber = /^\d+$/.test(y)
    if (xNumber && yNumber) return Number(x) - Number(y)
    if (xNumber !== yNumber) return xNumber ? -1 : 1
    return x.localeCompare(y)
  }
  return 0
}

function comparator(value: string): { operator: string; version: string } | null {
  const match = /^(>=|<=|>|<|=|\^|~)?\s*(\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/.exec(value.trim())
  if (match === null) return null
  const operator = match[1] ?? '='
  const rawVersion = match[2]
  const core = rawVersion.split(/[+-]/, 1)[0]!.split('.').map(Number)
  if (core.length === 0 || core.length > 3 || core.some(value => !Number.isInteger(value))) return null
  if (core.length < 3 && !['>', '>=', '<', '<=', '='].includes(operator)) return null
  const version = core.length === 3
    ? rawVersion
    : `${core.join('.')}${core.length === 1 ? '.0.0' : '.0'}-0`
  if (parseVersion(version) === null) return null
  return { operator, version }
}

function upperBound(version: string, operator: '^' | '~'): string | null {
  const parsed = parseVersion(version)
  if (parsed === null) return null
  const [major, minor, patch] = parsed.core
  if (operator === '~') return `${major}.${minor + 1}.0-0`
  if (major > 0) return `${major + 1}.0.0-0`
  if (minor > 0) return `0.${minor + 1}.0-0`
  return `0.0.${patch + 1}-0`
}

function satisfiesComparator(version: string, value: string): boolean {
  const parsed = comparator(value)
  if (parsed === null) return false
  const difference = compareVersions(version, parsed.version)
  switch (parsed.operator) {
    case '>': return difference > 0
    case '>=': return difference >= 0
    case '<': return difference < 0
    case '<=': return difference <= 0
    case '^': return difference >= 0 && upperBound(parsed.version, '^') !== null && compareVersions(version, upperBound(parsed.version, '^')!) < 0
    case '~': return difference >= 0 && upperBound(parsed.version, '~') !== null && compareVersions(version, upperBound(parsed.version, '~')!) < 0
    default: return difference === 0
  }
}

/**
 * Small, dependency-free range support for registry compatibility metadata.
 * It intentionally accepts the subset used by the catalog: exact versions,
 * comparator sets, caret/tilde ranges, and `||` alternatives.
 */
export function satisfiesVersionRange(version: string, range: string): boolean {
  if (parseVersion(version) === null) return false
  const normalized = range.trim()
  if (normalized === '' || normalized === '*' || normalized === 'x' || normalized === 'X') return true
  return normalized.split('||').some(alternative => {
    const terms = alternative.trim().split(/\s+/).filter(Boolean)
    return terms.length > 0 && terms.every(term => satisfiesComparator(version, term))
  })
}

export function isVersionRange(value: string): boolean {
  if (value.trim() === 'unverified') return true
  if (value.trim() === '') return false
  return value.split('||').every(alternative => alternative.trim().split(/\s+/).filter(Boolean).every(term => comparator(term) !== null))
}
