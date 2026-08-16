import type { IncomingMessage, ServerResponse } from 'node:http';
import { SkinLifecycle, type LifecycleHost } from './lifecycle.ts';
import type { PluginRunner } from './commands.ts';
import type { RestartScheduler } from './restart.ts';
export interface WebServerService {
    register(route: {
        kind: 'exact' | 'prefix';
        path: string;
        handler(request: IncomingMessage, response: ServerResponse): void | Promise<void>;
    }): () => void;
}
export interface SkinMarketHost extends LifecycleHost {
    webServer: WebServerService;
}
export interface RouteOptions {
    profile: string;
    profileDir: string;
    runner: PluginRunner;
    restart?: RestartScheduler;
}
export declare function canRestartSkin(state: ReturnType<SkinLifecycle['states']>[number] | undefined): boolean;
export declare function mountRoutes(host: SkinMarketHost, options: RouteOptions): () => void;
