import type { DshRuntime } from './types.ts';
export declare const KEYED_SLOT_CAPABILITY_PREFIX = "slot:keyed:";
export declare function runtimeCapabilities(version: string | null): string[];
export declare function detectDshRuntime(): DshRuntime;
export declare function hasRuntimeCapability(runtime: DshRuntime, capability: string): boolean;
