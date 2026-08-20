import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { commandError } from './commands.js';
export const MARKET_GITHUB_TARGET = 'github:kingOfSoySauce/dsh-skin-market';
export const MARKET_PACKAGE_URL = 'https://raw.githubusercontent.com/kingOfSoySauce/dsh-skin-market/main/package.json';
const PNPM_FETCH_TIMEOUT_MS = 10 * 60 * 1000;
class MarketProgressTracker {
    buffer = '';
    fetches = new Map();
    unknownSizes = new Set();
    samples = [];
    push(chunk, operation) {
        this.buffer += chunk;
        const lines = this.buffer.split(/\r?\n/);
        this.buffer = lines.pop() ?? '';
        for (const line of lines)
            this.consume(line, operation);
    }
    consume(line, operation) {
        let event;
        try {
            event = JSON.parse(line);
        }
        catch {
            return;
        }
        const packageId = typeof event.packageId === 'string' ? event.packageId : undefined;
        if (packageId === undefined)
            return;
        if (event.name === 'pnpm:fetching-progress' && event.status === 'started') {
            const size = typeof event.size === 'number' && Number.isFinite(event.size) ? event.size : undefined;
            this.fetches.set(packageId, { size, downloaded: 0 });
            if (size === undefined)
                this.unknownSizes.add(packageId);
            this.publish(operation);
            return;
        }
        if (event.name === 'pnpm:fetching-progress' && event.status === 'in_progress' && typeof event.downloaded === 'number') {
            const current = this.fetches.get(packageId) ?? { downloaded: 0 };
            current.downloaded = Math.max(current.downloaded, event.downloaded);
            this.fetches.set(packageId, current);
            this.publish(operation);
            return;
        }
        if (event.name === 'pnpm:progress' && event.status === 'fetched') {
            const current = this.fetches.get(packageId);
            if (current?.size !== undefined)
                current.downloaded = current.size;
            this.publish(operation);
        }
    }
    publish(operation) {
        if (this.fetches.size === 0)
            return;
        const totalKnown = this.unknownSizes.size === 0;
        const total = [...this.fetches.values()].reduce((sum, item) => sum + (item.size ?? 0), 0);
        const downloaded = [...this.fetches.values()].reduce((sum, item) => sum + Math.min(item.downloaded, item.size ?? item.downloaded), 0);
        if (downloaded > 0)
            operation.downloadedBytes = downloaded;
        else
            delete operation.downloadedBytes;
        if (totalKnown)
            operation.totalBytes = total;
        else
            delete operation.totalBytes;
        const now = Date.now();
        this.samples.push({ at: now, bytes: downloaded });
        this.samples = this.samples.filter(sample => now - sample.at <= 5000);
        const first = this.samples[0];
        const last = this.samples.at(-1);
        if (first !== undefined && last !== undefined && last.at > first.at && last.bytes > first.bytes) {
            operation.bytesPerSecond = Math.round((last.bytes - first.bytes) * 1000 / (last.at - first.at));
        }
    }
}
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
            const tracker = new MarketProgressTracker();
            const report = (chunk) => {
                if (operation.phase !== 'downloading' && operation.phase !== 'installing')
                    return;
                tracker.push(chunk, operation);
                if (chunk.trim() !== '')
                    operation.message = operation.phase === 'downloading' ? '正在下载皮肤市场更新包' : '正在写入皮肤市场更新';
            };
            const run = async (args) => {
                const result = await runner(profile, args, {
                    signal: controller.signal,
                    // pnpm's default 60s fetch timeout plus retries produces a misleading
                    // ~4 minute failure for a slow GitHub route. Keep self-update on the
                    // same 10 minute network budget as ordinary skin installs without
                    // writing a persistent .npmrc into the user's profile.
                    env: { 'npm_config_fetch-timeout': String(PNPM_FETCH_TIMEOUT_MS) },
                    onStdout: report,
                    onStderr: report,
                });
                if (result.exitCode !== 0 || result.timedOut || result.aborted)
                    throw new Error(commandError(result));
            };
            // Run one profile update only. A temporary prefetch followed by a
            // second `pnpm add` still makes GitHub targets resolve/fetch twice and
            // can leave the UI in "installing" for two full network operations.
            setOperation(operation, { phase: 'downloading', message: '正在下载皮肤市场更新包' });
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
