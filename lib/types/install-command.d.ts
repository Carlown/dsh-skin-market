/**
 * Format a DSH plugin install command for cmd.exe, PowerShell, and POSIX
 * shells. Single quotes are literal characters in cmd.exe, while double
 * quotes protect the `&path:` separator in the copied command.
 */
export declare function quoteInstallTarget(target: string): string;
export declare function createDshPluginAddCommand(target: string, profile?: string): string;
/**
 * Copied install command. Git subdirectory specs keep `&path:/`, which cmd.exe
 * splits when DSH forwards to pnpm with `shell: true`. Those specs go through
 * pnpm directly, matching the market's runtime bypass.
 */
export declare function createInstallCommand(target: string, profile?: string): string;
