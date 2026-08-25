export interface BuildApprovalSkin {
  subpath?: string
  install: { allowBuild?: string }
}

/**
 * pnpm includes a monorepo package's subpath in the git build approval key.
 * Keep the catalog value and the key written to pnpm-workspace.yaml aligned.
 */
export function effectiveBuildApprovalKey(skin: BuildApprovalSkin): string | undefined {
  const key = skin.install.allowBuild
  if (key === undefined || skin.subpath === undefined) return key

  const pathMarker = '#path:'
  const markerIndex = key.indexOf(pathMarker)
  const base = markerIndex === -1 ? key : key.slice(0, markerIndex)
  return `${base}${pathMarker}${skin.subpath}`
}

export function buildApprovalKeyForTarget(skin: BuildApprovalSkin, target: string): string | undefined {
  const key = skin.install.allowBuild
  if (key === undefined) return undefined
  const match = /^github:[^#]+#[0-9a-f]{40}&path:(\/?)([A-Za-z0-9._/-]+)$/i.exec(target)
  if (match === null) return key
  const subpath = `${match[1]}${match[2]}`
  const pathMarker = '#path:'
  const markerIndex = key.indexOf(pathMarker)
  const base = markerIndex === -1 ? key : key.slice(0, markerIndex)
  return `${base}${pathMarker}${subpath}`
}
