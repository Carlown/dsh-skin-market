import type { PluginRunner } from './commands.ts';
import type { DesktopInstallCapability, DshRuntime, LoaderEntry, MarketHostKind, Operation, OperationKind, SkinEntry, SkinRuntimeState } from './types.ts';
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
    hostKind?: MarketHostKind;
    runtime?: DshRuntime;
}
export declare function desktopInstallError(capability: DesktopInstallCapability | undefined): string;
export declare class SkinLifecycle {
    private readonly host;
    private readonly options;
    readonly operations: Map<string, Operation>;
    private activeOperation;
    private readonly abortControllers;
    private readonly pendingBuildKeys;
    private catalogEntries;
    private skinById;
    private disposeEvent?;
    constructor(host: LifecycleHost, options: LifecycleOptions, catalog?: SkinEntry[]);
    get catalog(): SkinEntry[];
    private get hostKind();
    private get runtime();
    private assertRuntimeCompatibility;
    private applyCompatibility;
    private repairMaterializedPackage;
    replaceCatalog(catalog: SkinEntry[]): Promise<void>;
    start(): void;
    dispose(): void;
    skin(id: string): SkinEntry;
    private entriesFor;
    private setEntryDisabled;
    private reconcileDisabledSkinIds;
    replay(): Promise<void>;
    states(): SkinRuntimeState[];
    currentOperation(): Operation | null;
    begin(kind: OperationKind, skinId: string, approvedBuildKey?: string): Operation;
    retry(id: string, action: 'retry' | 'approve-build'): Operation;
    private update;
    cancel(id: string): Operation;
    private execute;
    private run;
    private installPackage;
    private assertRuntimeLoaderConflicts;
    private prefetch;
    private install;
    private activate;
    private deactivate;
    private pin;
    private unpin;
    private updateSkin;
    private uninstall;
}
