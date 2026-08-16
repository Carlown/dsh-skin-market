import type { Context } from '@deepseek-ai/cordis';
export declare const name = "dsh-skin-market";
export interface Config {
    profile?: string;
}
export declare function apply(ctx: Context, config?: Config): void;
export { mountRoutes } from './routes.ts';
export { SkinLifecycle } from './lifecycle.ts';
