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
