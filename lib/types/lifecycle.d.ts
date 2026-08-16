import type { PluginRunner } from './commands.ts';
import type { LoaderEntry, Operation, OperationKind, SkinEntry, SkinRuntimeState } from './types.ts';
export interface LifecycleHost {
    loader: {
        entries(): Iterable<LoaderEntry>;
    };
    on?(event: string, callback: (fiber: {
        entry?: {
            options?: {
                name?: string;
                id?: string;
            };
        };
    }) => void): () => void;
}
export interface LifecycleOptions {
    profile: string;
    profileDir: string;
    runner: PluginRunner;
}
export declare class SkinLifecycle {
    private readonly host;
    private readonly options;
    readonly catalog: SkinEntry[];
    readonly operations: Map<string, Operation>;
    private activeOperation;
    private readonly skinById;
    private disposeEvent?;
    constructor(host: LifecycleHost, options: LifecycleOptions);
    start(): void;
    dispose(): void;
    skin(id: string): SkinEntry;
    private entriesFor;
    private setEntryDisabled;
    replay(): Promise<void>;
    states(): SkinRuntimeState[];
    currentOperation(): Operation | null;
    begin(kind: OperationKind, skinId: string): Operation;
    private update;
    private execute;
    private run;
    private install;
    private activate;
    private deactivate;
    private updateSkin;
    private uninstall;
}
