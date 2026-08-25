import { existsSync } from 'node:fs';
import { join } from 'node:path';
/** Return the directory pnpm will mutate for an argv list. */
function targetDirectory(profileDir, args) {
    const index = args.indexOf('--dir');
    const directory = index >= 0 ? args[index + 1] : undefined;
    return directory === undefined || directory.startsWith('-') ? profileDir : directory;
}
/**
 * pnpm 9 requires `-w` when adding at a workspace root, while all supported
 * pnpm versions reject `-w` outside a workspace. Decide from the directory
 * that the command will actually mutate, including temporary prefetch dirs.
 */
export function pluginArgsFor(profileDir, args) {
    const commandIndex = args.findIndex(arg => arg === 'add' || arg === 'remove');
    if (commandIndex < 0 || args.includes('-w') || args.includes('--workspace-root'))
        return [...args];
    if (!existsSync(join(targetDirectory(profileDir, args), 'pnpm-workspace.yaml')))
        return [...args];
    return [...args.slice(0, commandIndex + 1), '-w', ...args.slice(commandIndex + 1)];
}
