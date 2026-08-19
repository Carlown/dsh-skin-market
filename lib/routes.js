import { randomUUID } from 'node:crypto';
import { CatalogStore, catalogWithStars } from './catalog.js';
import { readRestartTarget, readSkinId, sameOrigin, sendJson } from './http.js';
import { SkinLifecycle } from './lifecycle.js';
import { installedClientPlugins } from './profile.js';
import { createMarketUpdater } from './self-update.js';
export function canRestartSkin(state) {
    return state?.installation === 'installed'
        && (state.activation === 'active' || state.activation === 'restart-required');
}
export function runningAgentCount(host) {
    return host.agents.list().filter(agent => agent.status === 'running').length;
}
export async function waitForRestartSafety(host) {
    const agents = host.agents.list();
    const running = agents.filter(agent => agent.status === 'running').length;
    if (running > 0)
        throw new Error(`检测到 ${running} 个 Agent 正在运行，请等待任务完全结束后再重启`);
    // An Agent can still be finishing maintenance while its public status is
    // idle. whenIdle() includes that maintenance and the turn checkpoint.
    await Promise.all(agents.map(agent => agent.whenIdle()));
    const startedDuringCheck = runningAgentCount(host);
    if (startedDuringCheck > 0)
        throw new Error(`检测到 ${startedDuringCheck} 个 Agent 刚刚开始运行，请稍后再重启`);
}
function method(request, response, expected) {
    if (request.method === expected)
        return true;
    response.writeHead(405, { allow: expected });
    response.end();
    return false;
}
export function mountRoutes(host, options) {
    const catalogStore = options.catalogStore ?? new CatalogStore(options.profileDir);
    const initialCatalog = catalogStore.snapshot().catalog;
    const lifecycle = new SkinLifecycle(host, options, initialCatalog.skins);
    lifecycle.start();
    let lifecycleCatalogGeneratedAt = initialCatalog.generatedAt;
    const instanceId = randomUUID();
    const marketUpdater = options.marketUpdater ?? createMarketUpdater(options.profile, options.runner);
    const catalogPayload = async (force) => {
        const snapshot = await catalogStore.refresh(force);
        if (snapshot.catalog.generatedAt !== lifecycleCatalogGeneratedAt) {
            await lifecycle.replaceCatalog(snapshot.catalog.skins);
            lifecycleCatalogGeneratedAt = snapshot.catalog.generatedAt;
        }
        return {
            schemaVersion: snapshot.catalog.schemaVersion,
            generatedAt: snapshot.catalog.generatedAt,
            skins: await catalogWithStars(options.profileDir, snapshot.catalog),
            catalogSource: snapshot.source,
            catalogLastCheckedAt: snapshot.lastCheckedAt,
            ...(snapshot.error ? { catalogError: snapshot.error } : {}),
        };
    };
    const mutation = (kind) => async (request, response) => {
        if (!method(request, response, 'POST'))
            return;
        if (!sameOrigin(request))
            return sendJson(response, 403, { error: 'same-origin request required' });
        try {
            const skinId = await readSkinId(request);
            const operation = lifecycle.begin(kind, skinId);
            sendJson(response, 202, { operationId: operation.id });
        }
        catch (error) {
            sendJson(response, 409, { error: error instanceof Error ? error.message : String(error) });
        }
    };
    const disposers = [
        host.webServer.register({ kind: 'exact', path: '/dsh-skin-market/catalog', handler: async (request, response) => {
                if (!method(request, response, 'GET'))
                    return;
                try {
                    sendJson(response, 200, await catalogPayload(false));
                }
                catch (error) {
                    sendJson(response, 502, { error: error instanceof Error ? error.message : String(error) });
                }
            } }),
        host.webServer.register({ kind: 'exact', path: '/dsh-skin-market/state', handler: (request, response) => {
                if (!method(request, response, 'GET'))
                    return;
                sendJson(response, 200, {
                    skins: lifecycle.states(),
                    installedClientPlugins: installedClientPlugins(options.profileDir, lifecycle.catalog),
                    operation: lifecycle.currentOperation(),
                    instanceId,
                    restartAvailable: options.restart?.available === true,
                    runningAgentCount: runningAgentCount(host),
                });
            } }),
        host.webServer.register({ kind: 'exact', path: '/dsh-skin-market/market-update', handler: async (request, response) => {
                if (request.method !== 'GET' && request.method !== 'POST') {
                    response.writeHead(405, { allow: 'GET, POST' });
                    response.end();
                    return;
                }
                if (request.method === 'POST' && !sameOrigin(request))
                    return sendJson(response, 403, { error: 'same-origin request required' });
                try {
                    sendJson(response, 200, request.method === 'POST' ? await marketUpdater.update() : await marketUpdater.status());
                }
                catch (error) {
                    sendJson(response, 502, { error: error instanceof Error ? error.message : String(error) });
                }
            } }),
        // Prefix routes must not end in `/`: DSH matches descendants by appending
        // its own slash (`pathname.startsWith(`${prefix}/`)`). A trailing slash
        // here would therefore only match a double-slash URL and let normal
        // operation polling fall through to index.html.
        host.webServer.register({ kind: 'prefix', path: '/dsh-skin-market/operations', handler: (request, response) => {
                if (!method(request, response, 'GET'))
                    return;
                const id = new URL(request.url ?? '/', 'http://localhost').pathname.split('/').pop() ?? '';
                const operation = lifecycle.operations.get(id);
                if (operation === undefined)
                    return sendJson(response, 404, { error: 'operation not found' });
                sendJson(response, 200, operation);
            } }),
        host.webServer.register({ kind: 'exact', path: '/dsh-skin-market/install', handler: mutation('install') }),
        host.webServer.register({ kind: 'exact', path: '/dsh-skin-market/activate', handler: mutation('activate') }),
        host.webServer.register({ kind: 'exact', path: '/dsh-skin-market/deactivate', handler: mutation('deactivate') }),
        host.webServer.register({ kind: 'exact', path: '/dsh-skin-market/update', handler: mutation('update') }),
        host.webServer.register({ kind: 'exact', path: '/dsh-skin-market/uninstall', handler: mutation('uninstall') }),
        host.webServer.register({ kind: 'exact', path: '/dsh-skin-market/restart', handler: async (request, response) => {
                if (!method(request, response, 'POST'))
                    return;
                if (!sameOrigin(request))
                    return sendJson(response, 403, { error: 'same-origin request required' });
                if (options.restart?.available !== true)
                    return sendJson(response, 501, { error: 'restart is unavailable in this DSH host' });
                try {
                    const target = await readRestartTarget(request);
                    if (target.kind === 'market-update') {
                        if (!marketUpdater.restartRequired)
                            return sendJson(response, 409, { error: '皮肤市场没有待应用的更新' });
                    }
                    else {
                        const skinState = lifecycle.states().find(item => item.skinId === target.skinId);
                        // Browser and Host loaders are separate. The browser can correctly
                        // require a restart while the Host half is already live, so accept
                        // either active representation for the selected installed skin.
                        if (!canRestartSkin(skinState))
                            return sendJson(response, 409, { error: '请先选择并使用此皮肤，再重新启动 DeepSeek Harness' });
                    }
                    await waitForRestartSafety(host);
                    sendJson(response, 202, { restarting: true, instanceId });
                    options.restart.schedule();
                }
                catch (error) {
                    sendJson(response, 409, { error: error instanceof Error ? error.message : String(error) });
                }
            } }),
    ];
    return () => {
        lifecycle.dispose();
        for (const dispose of disposers.reverse())
            dispose();
    };
}
