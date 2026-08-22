import { commandError } from './commands.js';
export class PnpmCommandError extends Error {
    failure;
    constructor(failure) {
        super(failure.message);
        this.failure = failure;
        this.name = 'PnpmCommandError';
    }
}
const RELEASE_AGE_OVERRIDE = '--config.minimumReleaseAge=0';
const FETCH_TIMEOUT_MS = 10 * 60 * 1000;
function outputOf(result) {
    return `${result.stdout}\n${result.stderr}`.trim();
}
function extractBuildKey(output) {
    const match = output.match(/(?:^|[\s'"`])((?:@[^\s/]+\/)?[^\s'"`]+@https?:\/\/[^\s'"`]+)(?=$|[\s'"`])/m);
    return match?.[1];
}
function packageNameFromBuildKey(key) {
    if (key === undefined)
        return undefined;
    const separator = key.indexOf('@https://') >= 0 ? key.indexOf('@https://') : key.indexOf('@http://');
    if (separator <= 0)
        return undefined;
    return key.slice(0, separator);
}
export function classifyPnpmFailure(result) {
    if (result.aborted)
        return { kind: 'command', message: '操作已取消' };
    const output = outputOf(result);
    if (/ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED|needs to execute build scripts.*not in allowBuilds/i.test(output)) {
        const buildKey = extractBuildKey(output);
        return {
            kind: 'build-approval',
            message: 'GitHub 插件包含被 pnpm 阻止的构建脚本；请批准精确构建项后重试',
            packageName: packageNameFromBuildKey(buildKey),
            buildKey,
        };
    }
    if (/minimumReleaseAge cutoff|within the minimumReleaseAge cutoff|verifyLockfileResolutions|ERR_PNPM.*RELEASE.*AGE/i.test(output)) {
        return {
            kind: 'release-age',
            message: '依赖仍受 pnpm 新包保护；已自动临时放宽并重试一次，请稍后再试',
        };
    }
    if (/\[23\].*aborted due to timeout|TimeoutError: The operation was aborted due to timeout|fetch timeout|ETIMEDOUT/i.test(output) || result.timedOut) {
        return {
            kind: 'fetch-timeout',
            message: commandError(result),
        };
    }
    if (/UND_ERR_DESTROYED|fetch failed|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket hang up|network request failed|network failed/i.test(output)) {
        return {
            kind: 'network',
            message: '插件下载遇到临时网络错误；已自动重试一次，请检查网络后重试',
        };
    }
    return { kind: 'command', message: commandError(result) };
}
function withReleaseAgeOverride(args) {
    const commandIndex = args.findIndex(arg => arg === 'add' || arg === 'remove' || arg === 'install');
    if (commandIndex < 0)
        return [...args, RELEASE_AGE_OVERRIDE];
    return [...args.slice(0, commandIndex + 1), RELEASE_AGE_OVERRIDE, ...args.slice(commandIndex + 1)];
}
function isAutomaticallyRecoverable(kind) {
    return kind === 'release-age' || kind === 'network' || kind === 'fetch-timeout';
}
export async function runPnpmWithRecovery(args, options) {
    const result = await options.attempt(args);
    if (result.exitCode === 0 && !result.timedOut && result.aborted !== true)
        return;
    const failure = classifyPnpmFailure(result);
    if (!isAutomaticallyRecoverable(failure.kind))
        throw new PnpmCommandError(failure);
    options.onRetry?.(failure);
    const retryArgs = failure.kind === 'release-age' ? withReleaseAgeOverride(args) : args;
    const retryOptions = failure.kind === 'fetch-timeout'
        ? { env: { pnpm_config_fetch_timeout: String(FETCH_TIMEOUT_MS) } }
        : undefined;
    const retryResult = await options.attempt(retryArgs, retryOptions);
    if (retryResult.exitCode === 0 && !retryResult.timedOut && retryResult.aborted !== true)
        return;
    throw new PnpmCommandError(classifyPnpmFailure(retryResult));
}
