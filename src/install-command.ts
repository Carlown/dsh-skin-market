/**
 * Format a DSH plugin install command for cmd.exe, PowerShell, and POSIX
 * shells. Single quotes are literal characters in cmd.exe, while double
 * quotes protect the `&path:` separator in the copied command.
 */
export function quoteInstallTarget(target: string): string {
  if (/[\u0000\r\n"]/.test(target)) throw new Error('install target contains unsupported command characters')
  return `"${target}"`
}

export function createDshPluginAddCommand(target: string, profile = 'web'): string {
  return `dsh plugin --profile ${profile} add ${quoteInstallTarget(target)}`
}
