import type { DshRuntime, SkinEntry } from './types.ts';
export interface CompatibilityPatchPlan {
    patchFile: string;
    patchRelativePath: string;
    packageName: string;
    packageVersion: string;
    originalSource: string;
    patchedSource: string;
    relativeSourcePath: string;
    adapterIds: string[];
    matchedAdapterIds: string[];
}
export type CompatibilityDecision = 'compatible' | 'adaptable' | 'unknown' | 'incompatible';
export interface CompatibilityAssessment {
    decision: CompatibilityDecision;
    reason: string;
    adapterIds: string[];
}
export declare function assessCompatibility(skin: SkinEntry, runtime: DshRuntime): CompatibilityAssessment;
export declare function planCompatibilityPatch(profileDir: string, skin: SkinEntry, runtime: DshRuntime): CompatibilityPatchPlan | null;
export declare function unifiedPatch(relativeSourcePath: string, original: string, patched: string): string;
export declare function persistCompatibilityPatch(profileDir: string, plan: CompatibilityPatchPlan): void;
