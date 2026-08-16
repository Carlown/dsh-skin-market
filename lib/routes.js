import { randomUUID } from 'node:crypto';
import { catalogWithStars, loadCatalog } from './catalog.js';
import { readSkinId, sameOrigin, sendJson } from './http.js';
import { SkinLifecycle } from './lifecycle.js';
export function canRestartSkin(state) {
    return state?.installation === 'installed'
        && (state.activation === 'active' || state.activation === 'restart-required');
}
function method(request, response, expected) {
    if (request.method === expected)
        return true;
    response.writeHead(405, { allow: expected });
    response.end();
    return false;
}
export function mountRoutes(host, options) {
    const lifecycle = new SkinLifecycle(host, options);
    lifecycle.start();
    const catalogFile = loadCatalog();
    const instanceId = randomUUID();
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
                const skins = await catalogWithStars(options.profileDir);
                sendJson(response, 200, { schemaVersion: catalogFile.schemaVersion, generatedAt: catalogFile.generatedAt, skins });
            } }),
        host.webServer.register({ kind: 'exact', path: '/dsh-skin-market/state', handler: (request, response) => {
                if (!method(request, response, 'GET'))
                    return;
                sendJson(response, 200, { skins: lifecycle.states(), operation: lifecycle.currentOperation(), instanceId, restartAvailable: options.restart?.available === true });
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
                    const skinId = await readSkinId(request);
                    const skinState = lifecycle.states().find(item => item.skinId === skinId);
                    // Browser and Host loaders are separate. The browser can correctly
                    // require a restart while the Host half is already live, so accept
                    // either active representation for the selected installed skin.
                    if (!canRestartSkin(skinState))
                        return sendJson(response, 409, { error: '请先选择并使用此皮肤，再重新启动 DeepSeek Harness' });
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
