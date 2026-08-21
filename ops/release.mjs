#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const rawArgs = process.argv.slice(2)
const flags = new Set(rawArgs.filter(arg => arg.startsWith('--')))
const positional = rawArgs.filter(arg => !arg.startsWith('--'))
const allowedFlags = new Set(['--dry-run', '--github-release'])
const requestedVersion = positional[0]?.replace(/^v/, '')
const dryRun = flags.has('--dry-run')
const createGithubRelease = flags.has('--github-release')

function fail(message) {
  console.error(`release: ${message}`)
  process.exit(1)
}

function executable(command) {
  return process.platform === 'win32' && command === 'npm' ? 'npm.cmd' : command
}

function run(command, args, options = {}) {
  const result = spawnSync(executable(command), args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    ...options,
  })
  if (result.error) fail(`${command} ${args.join(' ')}: ${result.error.message}`)
  if (result.status !== 0) fail(`${command} ${args.join(' ')} exited with ${result.status ?? 'no status'}`)
  return result
}

function capture(command, args) {
  const result = spawnSync(executable(command), args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  })
  if (result.error || result.status !== 0) fail(`${command} ${args.join(' ')} is unavailable or failed`)
  return result.stdout.trim()
}

function succeeds(command, args) {
  const result = spawnSync(executable(command), args, {
    cwd: root,
    stdio: 'ignore',
    shell: false,
  })
  return result.error === undefined && result.status === 0
}

function isSemver(version) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(version)
}

if (positional.length > 1 || [...flags].some(flag => !allowedFlags.has(flag))) {
  fail('usage: npm run release -- <version> [--dry-run] [--github-release]')
}

if (requestedVersion === undefined || !isSemver(requestedVersion)) {
  fail('version must be a semver such as 0.1.31')
}

const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const currentVersion = packageJson.version
const tag = `v${requestedVersion}`

if (requestedVersion === currentVersion) fail(`package is already at ${requestedVersion}`)
if (capture('git', ['branch', '--show-current']) !== 'main') fail('release must run from the main branch')
if (capture('git', ['status', '--porcelain=v1', '--untracked-files=all']) !== '') {
  fail('working tree is not clean; commit or stash changes before releasing')
}
if (succeeds('git', ['show-ref', '--tags', '--verify', '--quiet', `refs/tags/${tag}`])) {
  fail(`tag ${tag} already exists`)
}
if (createGithubRelease && !succeeds('gh', ['--version'])) fail('--github-release requires the gh CLI')

console.log(`release ${currentVersion} -> ${requestedVersion}`)
console.log('  1. npm run check')
console.log('  2. sync package.json and package-lock.json')
console.log('  3. commit and tag')
console.log('  4. npm publish')
console.log('  5. git push origin main --follow-tags')
if (createGithubRelease) console.log('  6. gh release create --generate-notes')

if (dryRun) process.exit(0)

run('npm', ['run', 'check'])
run('npm', ['version', requestedVersion, '--no-git-tag-version', '--ignore-scripts'])
run('npm', ['pack', '--dry-run', '--ignore-scripts'])

run('git', ['add', '-A'])
run('git', ['diff', '--cached', '--check'])
run('git', ['commit', '-m', `release: ${tag}`])
run('git', ['tag', '-a', tag, '-m', `Release ${tag}`])
run('npm', ['publish', '--ignore-scripts'])
run('git', ['push', 'origin', 'main', '--follow-tags'])
if (createGithubRelease) run('gh', ['release', 'create', tag, '--generate-notes', '--verify-tag'])

console.log(`release ${tag} complete`)
