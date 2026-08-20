import { type PluginRunner } from './commands.ts';
export declare const MARKET_GITHUB_TARGET = "github:kingOfSoySauce/dsh-skin-market";
export declare const MARKET_PACKAGE_URL = "https://raw.githubusercontent.com/kingOfSoySauce/dsh-skin-market/main/package.json";
export interface MarketUpdateStatus {
    currentVersion: string;
    latestVersion: string;
    updateAvailable: boolean;
}
export type MarketUpdatePhase = 'queued' | 'checking' | 'downloading' | 'installing' | 'cancelling' | 'cancelled' | 'done' | 'failed';
export interface MarketUpdateOperation {
    id: string;
    phase: MarketUpdatePhase;
    message?: string;
    status?: MarketUpdateStatus;
    cancelable?: boolean;
    downloadedBytes?: number;
    totalBytes?: number;
    bytesPerSecond?: number;
    startedAt: string;
    finishedAt?: string;
}
export interface MarketUpdater {
    status(force?: boolean): Promise<MarketUpdateStatus>;
    update(): Promise<MarketUpdateStatus>;
    startUpdate(): MarketUpdateOperation;
    operation(id: string): MarketUpdateOperation | null;
    currentOperation(): MarketUpdateOperation | null;
    cancel(id: string): MarketUpdateOperation;
    readonly restartRequired: boolean;
}
export declare function compareVersions(left: string, right: string): number;
export declare function createMarketUpdater(profile: string, runner: PluginRunner, options?: {
    currentVersion?: string;
    fetch?: typeof fetch;
    cacheMs?: number;
}): MarketUpdater;
