/**
 * Format a DSH plugin install command for cmd.exe, PowerShell, and POSIX
 * shells. Single quotes are literal characters in cmd.exe, while double
 * quotes protect the `&path:` separator in the copied command.
 */
export function quoteInstallTarget(target) {
    if (/[\u0000\r\n"]/.test(target))
        throw new Error('install target contains unsupported command characters');
    return `"${target}"`;
}
export function createDshPluginAddCommand(target, profile = 'web') {
    return `dsh plugin --profile ${profile} add ${quoteInstallTarget(target)}`;
}
/**
 * Copied install command. Git subdirectory specs keep `&path:/`, which cmd.exe
 * splits when DSH forwards to pnpm with `shell: true`. Those specs go through
 * pnpm directly, matching the market's runtime bypass.
 */
export function createInstallCommand(target, profile = 'web') {
    if (!target.includes('&'))
        return createDshPluginAddCommand(target, profile);
    return `pnpm add ${quoteInstallTarget(target)} --dir "$DSH_HOME/profiles/${profile}"`;
}
