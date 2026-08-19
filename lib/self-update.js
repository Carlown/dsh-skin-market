import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { commandError } from './commands.js';
export const MARKET_GITHUB_TARGET = 'github:kingOfSoySauce/dsh-skin-market';
export const MARKET_PACKAGE_URL = 'https://raw.githubusercontent.com/kingOfSoySauce/dsh-skin-market/main/package.json';
function packageVersion() {
    const packageFile = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    const value = JSON.parse(readFileSync(packageFile, 'utf8'));
    if (typeof value.version !== 'string')
        throw new Error('皮肤市场 package.json 缺少版本号');
    return value.version;
}
function semverParts(value) {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value);
    if (match === null)
        return null;
    return { core: [Number(match[1]), Number(match[2]), Number(match[3])], prerelease: match[4]?.split('.') ?? [] };
}
export function compareVersions(left, right) {
    const a = semverParts(left);
    const b = semverParts(right);
    if (a === null || b === null)
        return left.localeCompare(right);
    for (let index = 0; index < 3; index += 1) {
        if (a.core[index] !== b.core[index])
            return a.core[index] - b.core[index];
    }
    if (a.prerelease.length === 0 || b.prerelease.length === 0) {
        return a.prerelease.length === b.prerelease.length ? 0 : a.prerelease.length === 0 ? 1 : -1;
    }
    const length = Math.max(a.prerelease.length, b.prerelease.length);
    for (let index = 0; index < length; index += 1) {
        const x = a.prerelease[index];
        const y = b.prerelease[index];
        if (x === undefined || y === undefined)
            return x === y ? 0 : x === undefined ? -1 : 1;
        if (x === y)
            continue;
        const xNumber = /^\d+$/.test(x);
        const yNumber = /^\d+$/.test(y);
        if (xNumber && yNumber)
            return Number(x) - Number(y);
        if (xNumber !== yNumber)
            return xNumber ? -1 : 1;
        return x.localeCompare(y);
    }
    return 0;
}
export function createMarketUpdater(profile, runner, options = {}) {
    const fetchLatest = options.fetch ?? fetch;
    let installedVersion = options.currentVersion ?? packageVersion();
    const cacheMs = options.cacheMs ?? 5 * 60 * 1000;
    let cached = null;
    let updating = false;
    let restartRequired = false;
    const status = async (force = false) => {
        if (!force && cached !== null && Date.now() - cached.checkedAt < cacheMs)
            return cached.status;
        const response = await fetchLatest(MARKET_PACKAGE_URL, {
            headers: { accept: 'application/json', 'user-agent': `dsh-skin-market/${installedVersion}` },
            signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok)
            throw new Error(`GitHub 版本检查失败（HTTP ${response.status}）`);
        const value = await response.json();
        if (typeof value.version !== 'string' || semverParts(value.version) === null)
            throw new Error('GitHub package.json 版本号无效');
        const next = { currentVersion: installedVersion, latestVersion: value.version, updateAvailable: compareVersions(value.version, installedVersion) > 0 };
        cached = { checkedAt: Date.now(), status: next };
        return next;
    };
    return {
        status,
        get restartRequired() { return restartRequired; },
        async update() {
            if (updating)
                throw new Error('皮肤市场正在更新');
            updating = true;
            try {
                const before = await status(true);
                if (!before.updateAvailable)
                    return before;
                const result = await runner(profile, ['add', MARKET_GITHUB_TARGET]);
                if (result.exitCode !== 0 || result.timedOut)
                    throw new Error(commandError(result));
                installedVersion = before.latestVersion;
                restartRequired = true;
                const next = { currentVersion: installedVersion, latestVersion: installedVersion, updateAvailable: false };
                cached = { checkedAt: Date.now(), status: next };
                return next;
            }
            finally {
                updating = false;
            }
        },
    };
}
