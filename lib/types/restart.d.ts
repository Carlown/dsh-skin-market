import { spawn } from 'node:child_process';
export interface RestartScheduler {
    readonly available: boolean;
    schedule(): void;
}
interface RestartRuntime {
    execPath: string;
    argv: string[];
    cwd: string;
    env: NodeJS.ProcessEnv;
    pid: number;
    spawn: typeof spawn;
    setTimeout: typeof setTimeout;
}
/** Relaunch the current CLI invocation after its old PID has released the port. */
export declare function createCliRestartScheduler(exit: (code: number) => void, overrides?: Partial<RestartRuntime>): RestartScheduler;
export {};
