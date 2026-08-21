# Release operations

- Run release commands from the repository root on the `main` branch.
- Keep the worktree clean before invoking `npm run release`; the release script intentionally refuses to absorb unreviewed changes.
- Preview with `npm run release -- <version> --dry-run` before a real release.
- A real release runs the full check, synchronizes `package.json` and `package-lock.json`, commits the release, creates a `v<version>` tag, publishes npm, and pushes `main` with tags.
- Add `--github-release` only when a GitHub Release with generated notes is wanted; it requires an authenticated `gh` CLI.
- Never put npm tokens, GitHub tokens, `.env` files, disposable captures, caches, or audit reports into a release commit.
- If npm publish or GitHub push fails after the local release commit/tag is created, inspect the exact failure and resume only the failed external step; do not create a second version tag.
