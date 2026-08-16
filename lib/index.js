import { desktopRunner, runPluginCli } from './commands.js';
import { resolveProfileDir } from './profile.js';
import { mountRoutes } from './routes.js';
import { createCliRestartScheduler } from './restart.js';
export const name = 'dsh-skin-market';
function argvProfile() {
    const index = process.argv.indexOf('--profile');
    return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : undefined;
}
export function apply(ctx, config) {
    ctx.inject(['webServer', 'loader', 'agents'], hostContext => {
        const host = hostContext;
        const desktopProfiles = ctx.get('desktopProfiles');
        if (desktopProfiles === undefined) {
            const profile = config?.profile ?? argvProfile() ?? 'web';
            const profileDir = resolveProfileDir(profile);
            const appExit = ctx.get('appExit');
            const restart = appExit === undefined ? undefined : createCliRestartScheduler(appExit);
            host.effect(() => mountRoutes(host, { profile, profileDir, runner: runPluginCli, restart }), 'dsh-skin-market: routes');
            return;
        }
        hostContext.inject(['desktopPnpm'], desktopContext => {
            const current = desktopProfiles.current;
            const service = desktopContext.desktopPnpm;
            const desktopHost = desktopContext;
            desktopHost.effect(() => mountRoutes(host, { profile: current.name, profileDir: current.dir, runner: desktopRunner(service, current.dir) }), 'dsh-skin-market: desktop routes');
        });
    });
}
export { mountRoutes } from './routes.js';
export { SkinLifecycle } from './lifecycle.js';
