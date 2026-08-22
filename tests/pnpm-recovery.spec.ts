import { describe, expect, it } from 'vitest'
import { classifyPnpmFailure, PnpmCommandError, runPnpmWithRecovery } from '../src/pnpm-recovery.ts'
import type { CommandResult } from '../src/commands.ts'

function failed(output: string): CommandResult {
  return { exitCode: 1, stdout: '', stderr: output, timedOut: false }
}

function success(): CommandResult {
  return { exitCode: 0, stdout: '', stderr: '', timedOut: false }
}

describe('pnpm recovery', () => {
  it('retries a release-age failure with a command-scoped override', async () => {
    const calls: Array<{ args: readonly string[]; env?: NodeJS.ProcessEnv }> = []
    await runPnpmWithRecovery(['add', '@example/skin@1.0.0'], {
      attempt: async (args, options) => {
        calls.push({ args, env: options?.env })
        return calls.length === 1
          ? failed('@example/skin@1.0.0 was published within the minimumReleaseAge cutoff')
          : success()
      },
    })

    expect(calls).toHaveLength(2)
    expect(calls[0]?.args).toEqual(['add', '@example/skin@1.0.0'])
    expect(calls[1]?.args).toEqual(['add', '--config.minimumReleaseAge=0', '@example/skin@1.0.0'])
    expect(calls[1]?.env).toBeUndefined()
  })

  it('retries transient network failures with the original arguments', async () => {
    const attempts: Array<readonly string[]> = []
    await runPnpmWithRecovery(['remove', '@example/skin'], {
      attempt: async args => {
        attempts.push(args)
        return attempts.length === 1 ? failed('TypeError: fetch failed\ncause: UND_ERR_DESTROYED') : success()
      },
    })

    expect(attempts).toEqual([['remove', '@example/skin'], ['remove', '@example/skin']])
  })

  it('classifies a build block and extracts only the exact approval key', () => {
    const failure = classifyPnpmFailure(failed([
      'ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED',
      '@linxin666/dsh-web-ui-all@https://codeload.github.com/springbrand-lab/dsh-skin-universe/tar.gz/29fa777bdd8c9f7d93700c56c11a96a32634d967#path:packages/dsh-web-ui-all needs to execute build scripts but is not in allowBuilds',
    ].join('\n')))

    expect(failure).toMatchObject({
      kind: 'build-approval',
      packageName: '@linxin666/dsh-web-ui-all',
      buildKey: '@linxin666/dsh-web-ui-all@https://codeload.github.com/springbrand-lab/dsh-skin-universe/tar.gz/29fa777bdd8c9f7d93700c56c11a96a32634d967#path:packages/dsh-web-ui-all',
    })
  })

  it('does not let the generic DSH build hint hide a timeout', () => {
    const failure = classifyPnpmFailure({
      exitCode: 1,
      timedOut: false,
      stdout: '[23] The operation was aborted due to timeout',
      stderr: 'dsh: git-hosted plugins build on install via their prepare script, which pnpm blocks until allowed',
    })

    expect(failure.kind).toBe('fetch-timeout')
  })

  it('exposes a typed failure after the automatic recovery is exhausted', async () => {
    await expect(runPnpmWithRecovery(['add', 'new-package'], {
      attempt: async () => failed('published within the minimumReleaseAge cutoff'),
    })).rejects.toMatchObject({
      name: 'PnpmCommandError',
      failure: { kind: 'release-age' },
    } satisfies Partial<PnpmCommandError>)
  })
})
