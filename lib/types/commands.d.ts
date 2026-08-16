export interface CommandResult {
    exitCode: number | null;
    stdout: string;
    stderr: string;
    timedOut: boolean;
}
export type PluginRunner = (profile: string, args: readonly string[]) => Promise<CommandResult>;
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
