import { describe, expect, it } from 'vitest'
import { cmdCommandLine, commandError, normalizedEnvironment, quoteCmdArg } from '../src/commands.ts'

describe('Windows command shim quoting', () => {
  it('quotes cmd metacharacters as one argument', () => {
    const target = 'github:owner/repo#' + 'a'.repeat(40) + '&path:sub'
    expect(quoteCmdArg(target)).toBe(`"${target}"`)
    expect(cmdCommandLine(['dsh', 'plugin', '--profile', 'web', 'add', target]))
      .toContain(`"${target}"`)
  })

  it('quotes spaces and embedded double quotes without changing plain tokens', () => {
    expect(quoteCmdArg('C:\\Program Files\\DSH\\runtime.tgz')).toBe('"C:\\Program Files\\DSH\\runtime.tgz"')
    expect(quoteCmdArg('plain-token')).toBe('plain-token')
    expect(quoteCmdArg('value"with"quotes')).toBe('"value""with""quotes"')
  })
})

describe('plugin command errors', () => {
  it('normalizes the pnpm 11 fetch timeout environment key', () => {
    expect(normalizedEnvironment({ env: { 'npm_config-fetch-timeout': '600000' } }))
      .toMatchObject({ pnpm_config_fetch_timeout: '600000' })
  })

  it('keeps a GitHub fetch timeout from being hidden by generic build advice', () => {
    const message = commandError({
      exitCode: 1,
      timedOut: false,
      stdout: '[23] The operation was aborted due to timeout\nTimeoutError: The operation was aborted due to timeout',
      stderr: 'dsh: git-hosted plugins build on install via their prepare script, which pnpm blocks until allowed',
    })

    expect(message).toBe('GitHub 插件下载超时；安装包较大或当前网络较慢，请检查网络后重试')
  })

  it('explains the platform command limit in the timeout error', () => {
    expect(commandError({ exitCode: null, timedOut: true, stdout: '', stderr: '' }))
      .toBe('插件安装超过 10 分钟，已停止；请检查网络后重试')
  })
})
