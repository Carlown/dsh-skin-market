import { spawn } from 'node:child_process'

export interface RestartScheduler {
  readonly available: boolean
  schedule(): void
}

interface RestartRuntime {
  execPath: string
  argv: string[]
  cwd: string
  env: NodeJS.ProcessEnv
  pid: number
  spawn: typeof spawn
  setTimeout: typeof setTimeout
}

const RELAUNCH_HELPER = String.raw`
const { spawn } = require('node:child_process')
const [parentPid, executable, cwd, argsJson] = process.argv.slice(1)
const args = JSON.parse(argsJson)
const waitForParent = () => {
  try {
    process.kill(Number(parentPid), 0)
    setTimeout(waitForParent, 100)
  } catch {
    const child = spawn(executable, args, {
      cwd,
      env: process.env,
      // The helper is already detached from the old DSH. Keep the relaunched
      // process attached so this helper supervises it instead of abandoning a
      // detached grandchild immediately.
      detached: false,
      stdio: 'ignore',
    })
    child.once('error', () => process.exit(1))
    child.once('exit', (code) => process.exit(code == null ? 1 : code))
  }
}
waitForParent()
`

/** Relaunch the current CLI invocation after its old PID has released the port. */
export function createCliRestartScheduler(exit: (code: number) => void, overrides: Partial<RestartRuntime> = {}): RestartScheduler {
  const runtime: RestartRuntime = {
    execPath: process.execPath,
    argv: [...process.argv],
    cwd: process.cwd(),
    env: process.env,
    pid: process.pid,
    spawn,
    setTimeout,
    ...overrides,
  }
  let scheduled = false
  return {
    available: true,
    schedule() {
      if (scheduled) return
      scheduled = true
      const helper = runtime.spawn(runtime.execPath, [
        '-e',
        RELAUNCH_HELPER,
        String(runtime.pid),
        runtime.execPath,
        runtime.cwd,
        JSON.stringify(runtime.argv.slice(1)),
      ], {
        cwd: runtime.cwd,
        env: runtime.env,
        detached: true,
        stdio: 'ignore',
      })
      helper.unref()
      const timer = runtime.setTimeout(() => exit(0), 150)
      timer.unref?.()
    },
  }
}
