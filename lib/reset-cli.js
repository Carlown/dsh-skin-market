#!/usr/bin/env node
import { resolveProfileDir } from './profile.js';
import { resetManagedSkins } from './reset.js';
function valueAfter(name) {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
}
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: dsh-skin-market-reset [--profile web] [--profile-dir /path/to/profile]');
    console.log('Disables every skin managed by DSH Skin Market without uninstalling its packages.');
    process.exit(0);
}
try {
    const profile = valueAfter('--profile') ?? 'web';
    const profileDir = resolveProfileDir(profile, valueAfter('--profile-dir'));
    const result = resetManagedSkins(profileDir);
    console.log(`Disabled ${result.disabledPackages.length} market-managed skin(s) in profile "${profile}".`);
    if (result.disabledPackages.length > 0)
        console.log(result.disabledPackages.map(name => `- ${name}`).join('\n'));
    console.log('Restart DSH to restore the default appearance. Installed skin packages were kept.');
}
catch (error) {
    console.error(`Skin reset failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
}
