/**
 * pnpm 9 requires `-w` when adding at a workspace root, while all supported
 * pnpm versions reject `-w` outside a workspace. Decide from the directory
 * that the command will actually mutate, including temporary prefetch dirs.
 */
export declare function pluginArgsFor(profileDir: string, args: readonly string[]): string[];
