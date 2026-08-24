import { type CommandResult } from './commands.ts';
export type PnpmFailureKind = 'release-age' | 'network' | 'fetch-timeout' | 'build-approval' | 'command';
export interface PnpmFailure {
    kind: PnpmFailureKind;
    message: string;
    packageName?: string;
    buildKey?: string;
    recovery?: 'disable-peer-autoinstall';
}
export declare class PnpmCommandError extends Error {
    readonly failure: PnpmFailure;
    constructor(failure: PnpmFailure);
}
export interface PnpmAttemptOptions {
    env?: NodeJS.ProcessEnv;
}
export interface PnpmRecoveryOptions {
    attempt: (args: readonly string[], options?: PnpmAttemptOptions) => Promise<CommandResult>;
    onRetry?: (failure: PnpmFailure) => void;
    profileDir?: string;
}
export declare function classifyPnpmFailure(result: CommandResult): PnpmFailure;
export declare function runPnpmWithRecovery(args: readonly string[], options: PnpmRecoveryOptions): Promise<void>;
