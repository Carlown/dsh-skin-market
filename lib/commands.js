import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
function dshInvocation() {
    const entry = process.argv[1];
    if (entry !== undefined && /[\\/](?:bin\.(?:js|ts)|dsh)$/.test(entry)) {
        const absolute = resolve(entry);
        return { file: process.execPath, prefix: [...process.execArgv, absolute], cwd: dirname(absolute) };
    }
    return { file: 'dsh', prefix: [] };
}
export const runPluginCli = (profile, args) => new Promise(resolvePromise => {
    const invocation = dshInvocation();
    const env = { ...process.env, CI: 'true' };
    if (process.platform !== 'win32') {
        const parts = (env.PATH ?? '').split(':').filter(Boolean);
        for (const value of ['/opt/homebrew/bin', '/usr/local/bin', join(process.env.HOME ?? '', '.local', 'bin')]) {
            if (value !== '' && !parts.includes(value))
                parts.push(value);
        }
        env.PATH = parts.join(':');
    }
    const child = spawn(invocation.file, [...invocation.prefix, 'plugin', '--profile', profile, ...args], {
        cwd: invocation.cwd,
        env,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout?.on('data', chunk => { stdout += String(chunk); });
    child.stderr?.on('data', chunk => { stderr += String(chunk); });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 10 * 60 * 1000);
    child.on('error', error => { stderr += error.message; });
    child.on('close', exitCode => {
        clearTimeout(timer);
        resolvePromise({ exitCode, stdout, stderr, timedOut });
    });
});
export function desktopRunner(service, profileDir) {
    return async (_profile, args) => {
        const operation = service.runPlugin(args, profileDir);
        let stdout = '';
        let stderr = '';
        operation.stdout.on('data', chunk => { stdout += String(chunk); });
        operation.stderr.on('data', chunk => { stderr += String(chunk); });
        const result = await operation.done;
        return { exitCode: result.exitCode, stdout, stderr, timedOut: false };
    };
}
export function commandError(result) {
    if (result.timedOut)
        return 'plugin command timed out';
    return (result.stderr || result.stdout || `plugin command exited ${String(result.exitCode)}`).trim().slice(-800);
}
