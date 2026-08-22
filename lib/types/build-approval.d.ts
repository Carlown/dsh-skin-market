export interface BuildApprovalSkin {
    subpath?: string;
    install: {
        allowBuild?: string;
    };
}
/**
 * pnpm includes a monorepo package's subpath in the git build approval key.
 * Keep the catalog value and the key written to pnpm-workspace.yaml aligned.
 */
export declare function effectiveBuildApprovalKey(skin: BuildApprovalSkin): string | undefined;
export declare function buildApprovalKeyForTarget(skin: BuildApprovalSkin, target: string): string | undefined;
