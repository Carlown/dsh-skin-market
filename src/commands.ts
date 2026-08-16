import { spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'

export interface CommandResult {
  exitCode: number | null
  stdout: string
  stderr: string
  timedOut: boolean
}

export type PluginRunner = (profile: string, args: readonly string[]) => Promise<CommandResult>

function dshInvocation(): { file: string; prefix: string[]; cwd?: string } {
  const entry = process.argv[1]
  if (entry !== undefined && /[\\/](?:bin\.(?:js|ts)|dsh)$/.test(entry)) {
    const absolute = resolve(entry)
    return { file: process.execPath, prefix: [...process.execArgv, absolute], cwd: dirname(absolute) }
  }
  return { file: 'dsh', prefix: [] }
}

export const runPluginCli: PluginRunner = (profile, args) => new Promise(resolvePromise => {
  const invocation = dshInvocation()
  const env: NodeJS.ProcessEnv = { ...process.env, CI: 'true' }
  if (process.platform !== 'win32') {
    const parts = (env.PATH ?? '').split(':').filter(Boolean)
    for (const value of ['/opt/homebrew/bin', '/usr/local/bin', join(process.env.HOME ?? '', '.local', 'bin')]) {
      if (value !== '' && !parts.includes(value)) parts.push(value)
    }
    env.PATH = parts.join(':')
  }
  const child = spawn(invocation.file, [...invocation.prefix, 'plugin', '--profile', profile, ...args], {
    cwd: invocation.cwd,
    env,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  let timedOut = false
  child.stdout?.on('data', chunk => { stdout += String(chunk) })
  child.stderr?.on('data', chunk => { stderr += String(chunk) })
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL') }, 10 * 60 * 1000)
  child.on('error', error => { stderr += error.message })
  child.on('close', exitCode => {
    clearTimeout(timer)
    resolvePromise({ exitCode, stdout, stderr, timedOut })
  })
})

export interface DesktopPnpmLike {
  runPlugin(args: readonly string[], invokingDir: string, signal?: AbortSignal): {
    stdout: NodeJS.ReadableStream
    stderr: NodeJS.ReadableStream
    done: Promise<{ exitCode: number | null }>
  }
}

export function desktopRunner(service: DesktopPnpmLike, profileDir: string): PluginRunner {
  return async (_profile, args) => {
    const operation = service.runPlugin(args, profileDir)
    let stdout = ''
    let stderr = ''
    operation.stdout.on('data', chunk => { stdout += String(chunk) })
    operation.stderr.on('data', chunk => { stderr += String(chunk) })
    const result = await operation.done
    return { exitCode: result.exitCode, stdout, stderr, timedOut: false }
  }
}

export function commandError(result: CommandResult): string {
  if (result.timedOut) return 'plugin command timed out'
  return (result.stderr || result.stdout || `plugin command exited ${String(result.exitCode)}`).trim().slice(-800)
}
