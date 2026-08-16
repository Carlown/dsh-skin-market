import type { IncomingMessage, ServerResponse } from 'node:http';
export declare function sendJson(response: ServerResponse, status: number, value: unknown): void;
export declare function sameOrigin(request: IncomingMessage): boolean;
export declare function readSkinId(request: IncomingMessage, limit?: number): Promise<string>;
