import { type CommandResult } from './commands.ts';
export type PnpmFailureKind = 'release-age' | 'network' | 'fetch-timeout' | 'build-approval' | 'command';
export interface PnpmFailure {
    kind: PnpmFailureKind;
    message: string;
    packageName?: string;
    buildKey?: string;
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
}
export declare function classifyPnpmFailure(result: CommandResult): PnpmFailure;
export declare function runPnpmWithRecovery(args: readonly string[], options: PnpmRecoveryOptions): Promise<void>;
