import type { MarketHostKind } from './types.ts';
export interface CommandResult {
    exitCode: number | null;
    stdout: string;
    stderr: string;
    timedOut: boolean;
    aborted?: boolean;
}
export interface CommandOptions {
    signal?: AbortSignal;
    env?: NodeJS.ProcessEnv;
    onStdout?: (chunk: string) => void;
    onStderr?: (chunk: string) => void;
}
export interface PluginInstallRequest {
    packageName: string;
    packageVersion: string;
    receiptId: string;
    pnpmOptions?: readonly string[];
}
export interface PluginRunner {
    (profile: string, args: readonly string[], options?: CommandOptions): Promise<CommandResult>;
    hostKind?: MarketHostKind;
    installPlugin?: (profile: string, request: PluginInstallRequest, options?: CommandOptions) => Promise<CommandResult>;
}
export declare function normalizedEnvironment(options?: CommandOptions): NodeJS.ProcessEnv | undefined;
export declare const winCmdShim: boolean;
/** Quote one argv token before passing it through cmd.exe. */
export declare function quoteCmdArg(arg: string): string;
/** Build the command line used by the explicit Windows cmd.exe bridge. */
export declare function cmdCommandLine(argv: readonly string[]): string;
export declare const runPluginCli: PluginRunner;
export interface DesktopPnpmLike {
    runPlugin(args: readonly string[], invokingDir: string, signal?: AbortSignal): {
        stdout: NodeJS.ReadableStream;
        stderr: NodeJS.ReadableStream;
        done: Promise<{
            exitCode: number | null;
            signal: NodeJS.Signals | null;
        }>;
        cancel(): void;
    };
    installPlugin(request: {
        pnpmOptions?: readonly string[];
        invokingDir: string;
        recovery: {
            packageName: string;
            packageVersion: string;
            receiptId: string;
        };
        signal?: AbortSignal;
    }): Promise<{
        stdout: NodeJS.ReadableStream;
        stderr: NodeJS.ReadableStream;
        done: Promise<{
            exitCode: number | null;
            signal: NodeJS.Signals | null;
        }>;
        cancel(): void;
    }>;
}
export declare function desktopRunner(service: DesktopPnpmLike, profileDir: string): PluginRunner;
export declare function commandError(result: CommandResult): string;
