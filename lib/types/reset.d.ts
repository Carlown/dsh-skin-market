import type { SkinEntry } from './types.ts';
export interface ResetResult {
    disabledSkinIds: string[];
    disabledPackages: string[];
}
export declare function resetManagedSkins(profileDir: string, catalog?: SkinEntry[]): ResetResult;
