export interface CommandResult {
    exitCode: number | null;
    stdout: string;
    stderr: string;
    timedOut: boolean;
    aborted?: boolean;
}
export interface CommandOptions {
    signal?: AbortSignal;
    onStdout?: (chunk: string) => void;
    onStderr?: (chunk: string) => void;
}
export type PluginRunner = (profile: string, args: readonly string[], options?: CommandOptions) => Promise<CommandResult>;
export declare const runPluginCli: PluginRunner;
export interface DesktopPnpmLike {
    runPlugin(args: readonly string[], invokingDir: string, signal?: AbortSignal): {
        stdout: NodeJS.ReadableStream;
        stderr: NodeJS.ReadableStream;
        done: Promise<{
            exitCode: number | null;
        }>;
    };
}
export declare function desktopRunner(service: DesktopPnpmLike, profileDir: string): PluginRunner;
export declare function commandError(result: CommandResult): string;
