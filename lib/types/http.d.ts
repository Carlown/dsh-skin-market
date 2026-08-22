import type { IncomingMessage, ServerResponse } from 'node:http';
export declare function sendJson(response: ServerResponse, status: number, value: unknown): void;
export declare function sameOrigin(request: IncomingMessage): boolean;
export declare function readSkinId(request: IncomingMessage, limit?: number): Promise<string>;
export declare function readOperationRetryAction(request: IncomingMessage, limit?: number): Promise<'retry' | 'approve-build'>;
export type RestartTarget = {
    kind: 'skin';
    skinId: string;
} | {
    kind: 'market-update';
};
export declare function readRestartTarget(request: IncomingMessage, limit?: number): Promise<RestartTarget>;
