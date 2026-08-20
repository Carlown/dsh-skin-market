import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
    let activeOperation = null;
    const operations = new Map();
    const abortControllers = new Map();
    const setOperation = (operation, patch) => {
        Object.assign(operation, patch);
        operation.cancelable = !['done', 'failed', 'cancelled', 'cancelling'].includes(operation.phase);
        if (operation.phase === 'done' || operation.phase === 'failed' || operation.phase === 'cancelled') {
            operation.finishedAt = new Date().toISOString();
            if (activeOperation === operation.id)
                activeOperation = null;
        }
    };
    const updateTarget = async (operation, controller) => {
        try {
            setOperation(operation, { phase: 'checking', message: '正在检查皮肤市场版本' });
            const before = await status(true);
            operation.status = before;
            if (!before.updateAvailable) {
                setOperation(operation, { phase: 'done', message: '已经是最新版本', status: before });
                return;
            }
            const report = (chunk) => {
                if (operation.phase !== 'downloading' && operation.phase !== 'installing')
                    return;
                if (chunk.trim() !== '')
                    operation.message = operation.phase === 'downloading' ? '正在下载皮肤市场更新包' : '正在写入皮肤市场更新';
            };
            const run = async (args) => {
                const result = await runner(profile, args, {
                    signal: controller.signal,
                    onStdout: report,
                    onStderr: report,
                });
                if (result.exitCode !== 0 || result.timedOut || result.aborted)
                    throw new Error(commandError(result));
            };
            // Resolve the GitHub package in an isolated temporary project first.
            // The numeric value in .npmrc avoids pnpm 11 parsing dotted CLI config
            // values as strings and failing inside its retry timer.
            const directory = mkdtempSync(join(tmpdir(), 'dsh-market-self-update-'));
            writeFileSync(join(directory, 'package.json'), '{"private":true}\n', 'utf8');
            writeFileSync(join(directory, '.npmrc'), 'fetch-timeout=600000\n', 'utf8');
            try {
                setOperation(operation, { phase: 'downloading', message: '正在下载皮肤市场更新包' });
                await run(['add', MARKET_GITHUB_TARGET, '--dir', directory, '--ignore-scripts', '--reporter=ndjson']);
            }
            finally {
                rmSync(directory, { recursive: true, force: true });
            }
            setOperation(operation, { phase: 'installing', message: '正在写入皮肤市场更新' });
            await run(['add', MARKET_GITHUB_TARGET, '--prefer-offline', '--reporter=ndjson']);
            installedVersion = before.latestVersion;
            restartRequired = true;
            const next = { currentVersion: installedVersion, latestVersion: installedVersion, updateAvailable: false };
            cached = { checkedAt: Date.now(), status: next };
            setOperation(operation, { phase: 'done', message: '更新完成，重启 DSH 后生效', status: next });
        }
        catch (error) {
            if (controller.signal.aborted)
                setOperation(operation, { phase: 'cancelled', message: '更新已取消' });
            else
                setOperation(operation, { phase: 'failed', message: error instanceof Error ? error.message : String(error) });
        }
        finally {
            abortControllers.delete(operation.id);
            updating = false;
        }
    };
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
    const startUpdate = () => {
        if (activeOperation !== null)
            return operations.get(activeOperation);
        const operation = { id: randomUUID(), phase: 'queued', cancelable: true, startedAt: new Date().toISOString() };
        operations.set(operation.id, operation);
        activeOperation = operation.id;
        updating = true;
        const controller = new AbortController();
        abortControllers.set(operation.id, controller);
        void updateTarget(operation, controller);
        const timer = setTimeout(() => operations.delete(operation.id), 30 * 60 * 1000);
        timer.unref?.();
        return operation;
    };
    return {
        status,
        get restartRequired() { return restartRequired; },
        async update() {
            if (updating)
                throw new Error('皮肤市场正在更新');
            const operation = startUpdate();
            while (operation.phase !== 'done' && operation.phase !== 'failed' && operation.phase !== 'cancelled') {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            if (operation.phase !== 'done' || operation.status === undefined)
                throw new Error(operation.message ?? '皮肤市场更新失败');
            return operation.status;
        },
        startUpdate,
        operation(id) { return operations.get(id) ?? null; },
        currentOperation() { return activeOperation === null ? null : operations.get(activeOperation) ?? null; },
        cancel(id) {
            const operation = operations.get(id);
            if (operation === undefined)
                throw new Error('更新任务不存在');
            if (operation.cancelable !== true)
                return operation;
            setOperation(operation, { phase: 'cancelling', message: '正在取消皮肤市场更新' });
            abortControllers.get(id)?.abort();
            return operation;
        },
    };
}
