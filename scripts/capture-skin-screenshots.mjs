import { spawn } from 'node:child_process'
import { createWriteStream, existsSync } from 'node:fs'
import { cp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const defaultCacheDir = join(root, '.preview', 'skin-screenshot-cache')
const defaultOutputDir = join(root, '.preview', 'skin-screenshots')

// Start deliberately small. Add another reviewed target only after its settings
// surface and a stable screenshot-ready marker have been identified.
const targets = [
  {
    id: 'kingao294.dsh-skin',
    owner: 'KinGao294',
    repo: 'dsh-skin',
    package: 'dsh-skin',
    version: '0.3.1',
    commit: '65c79b09d4c5f23e72076ff6b6b6b26c883f935c',
    readyText: /皮肤|Skins/,
    localStorage: { 'dsh-skin:skin': 'skin-ocean' },
  },
  {
    id: 'tianyhjg-lab.dsh-font',
    owner: 'tianyhjg-lab',
    repo: 'dsh-font',
    package: 'dsh-font',
    version: '1.1.0',
    commit: 'd299f56bde1e10e7fef152848e74cff2eecd7917',
    readyText: /字体|Fonts/,
    localStorage: { 'dsh-font:ui': 'pingfang', 'dsh-font:code': 'menlo' },
  },
  {
    id: 'bilbillm.deepseek-harness-angelina-themes',
    owner: 'bilbillm',
    repo: 'deepseek-harness-angelina-themes',
    package: 'dsh-angelina-themes',
    version: '0.1.0',
    commit: '0286059df24bbfbce01bcdc9746b3d04c678c28e',
    readyText: /安洁莉娜主题|Angelina themes/i,
    selectionText: /安洁莉娜暗色|Angelina Dark/i,
    expectedTheme: 'angelina-dark',
    localStorage: { 'dsh-angelina-themes.selection': 'angelina-dark' },
  },
]

function usage() {
  console.log(`Usage: node scripts/capture-skin-screenshots.mjs [options]

Options:
  --prepare-only       Download pinned source archives, then exit
  --download-missing   Download a pinned archive only when it is not cached
  --skin <id>          Capture one target (repeatable; default: all reviewed targets)
  --cache-dir <path>   Archive/source cache (default: .preview/skin-screenshot-cache)
  --output-dir <path>  PNG and report directory (default: .preview/skin-screenshots)
  --port-base <port>   First isolated DSH port (default: 18765)
  --headed             Show Chrome while capturing
  --keep-work          Keep disposable DSH homes and extracted sources
  --help               Show this help

The capture phase is offline by default. Each target produces home.png,
conversation.png, and settings.png. A reusable isolated history template is
seeded once with a loopback mock model that reports zero usage. Every target
then clones that template and only opens the existing test session from the
left history; target captures never send a prompt. Run
npm run screenshots:prepare once while online, then npm run screenshots:capture
as often as needed offline.`)
}

function parseArgs(argv) {
  const options = {
    cacheDir: defaultCacheDir,
    outputDir: defaultOutputDir,
    portBase: 18765,
    prepareOnly: false,
    downloadMissing: false,
    headed: false,
    keepWork: false,
    skinIds: [],
  }
  const valueAfter = (index, name) => {
    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--')) throw new Error(`${name} requires a value`)
    return value
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help') { usage(); process.exit(0) }
    else if (arg === '--prepare-only') options.prepareOnly = true
    else if (arg === '--download-missing') options.downloadMissing = true
    else if (arg === '--headed') options.headed = true
    else if (arg === '--keep-work') options.keepWork = true
    else if (arg === '--skin') options.skinIds.push(valueAfter(index++, arg))
    else if (arg === '--cache-dir') options.cacheDir = resolve(valueAfter(index++, arg))
    else if (arg === '--output-dir') options.outputDir = resolve(valueAfter(index++, arg))
    else if (arg === '--port-base') options.portBase = Number(valueAfter(index++, arg))
    else throw new Error(`unknown option: ${arg}`)
  }
  if (!Number.isInteger(options.portBase) || options.portBase < 1024 || options.portBase > 65000) {
    throw new Error('--port-base must be an integer between 1024 and 65000')
  }
  return options
}

function selectedTargets(ids) {
  if (ids.length === 0) return targets
  const unique = [...new Set(ids)]
  return unique.map(id => {
    const target = targets.find(item => item.id === id)
    if (target === undefined) throw new Error(`unknown skin id: ${id}`)
    return target
  })
}

function safeChild(parent, child) {
  const parentPath = resolve(parent)
  const childPath = resolve(child)
  const rel = relative(parentPath, childPath)
  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || resolve(childPath) === root) {
    throw new Error(`refusing unsafe work path: ${childPath}`)
  }
  return childPath
}

async function run(command, args, options = {}) {
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? root,
      env: { ...process.env, ...options.env },
      stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', chunk => { stdout += chunk })
    child.stderr?.on('data', chunk => { stderr += chunk })
    child.once('error', reject)
    child.once('close', code => {
      if (code === 0) resolvePromise({ stdout, stderr })
      else reject(new Error(`${command} ${args.join(' ')} failed (${code})\n${stderr || stdout}`))
    })
  })
}

function archivePath(cacheDir, target) {
  return join(cacheDir, 'archives', `${target.owner}__${target.repo}__${target.commit}.tar.gz`)
}

async function downloadArchive(cacheDir, target) {
  const destination = archivePath(cacheDir, target)
  if (existsSync(destination) && (await stat(destination)).size > 0) {
    console.log(`[cache] ${target.id}`)
    return destination
  }
  await mkdir(dirname(destination), { recursive: true })
  const temporary = `${destination}.${process.pid}.tmp`
  const url = `https://codeload.github.com/${target.owner}/${target.repo}/tar.gz/${target.commit}`
  console.log(`[download] ${target.id} @ ${target.commit.slice(0, 12)}`)
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(60_000) })
  if (!response.ok || response.body === null) throw new Error(`download failed (${response.status}) for ${url}`)
  try {
    await pipeline(response.body, createWriteStream(temporary, { flags: 'wx' }))
    await rename(temporary, destination)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
  return destination
}

async function requireArchive(cacheDir, target, allowDownload) {
  const archive = archivePath(cacheDir, target)
  if (existsSync(archive) && (await stat(archive)).size > 0) return archive
  if (allowDownload) return await downloadArchive(cacheDir, target)
  throw new Error(`missing offline archive for ${target.id}: ${archive}\nRun npm run screenshots:prepare while online first.`)
}

async function extractSource(workRoot, archive, target) {
  const sourceDir = safeChild(workRoot, join(workRoot, 'sources', target.id))
  await rm(sourceDir, { recursive: true, force: true })
  await mkdir(sourceDir, { recursive: true })
  await run('tar', ['-xzf', archive, '--strip-components=1', '-C', sourceDir])
  const manifest = JSON.parse(await readFile(join(sourceDir, 'package.json'), 'utf8'))
  if (manifest.name !== target.package || manifest.version !== target.version) {
    throw new Error(`${target.id}: archive package identity mismatch`)
  }
  return sourceDir
}

async function installOffline(dshHome, sourceDir, target) {
  const env = { DSH_HOME: dshHome }
  console.log(`[install:offline] ${target.id}`)
  await run('dsh', ['plugin', '--profile', 'web', 'install', '--offline'], { env })
  await run('dsh', ['plugin', '--profile', 'web', 'add', '--offline', '-w', sourceDir], { env })
  const installed = join(dshHome, 'profiles', 'web', 'node_modules', target.package, 'package.json')
  const manifest = JSON.parse(await readFile(installed, 'utf8'))
  if (manifest.name !== target.package || manifest.version !== target.version) {
    throw new Error(`${target.id}: DSH installed an unexpected package`)
  }
}

async function installBaseOffline(dshHome) {
  await run('dsh', ['plugin', '--profile', 'web', 'install', '--offline'], { env: { DSH_HOME: dshHome } })
}

async function waitForServer(url, child, timeoutMs = 30_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode !== null) throw new Error(`DSH Web exited before becoming ready (${child.exitCode})`)
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) })
      if (response.ok) return
    } catch { /* not listening yet */ }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 250))
  }
  throw new Error(`timed out waiting for ${url}`)
}

async function stopServer(child) {
  if (child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise(resolvePromise => child.once('close', resolvePromise)),
    new Promise(resolvePromise => setTimeout(resolvePromise, 5_000)),
  ])
  if (child.exitCode === null) child.kill('SIGKILL')
}

async function startMockModelServer(port) {
  let requestCount = 0
  const server = createServer((request, response) => {
    if (request.method !== 'POST' || request.url !== '/chat/completions') {
      response.writeHead(404).end()
      return
    }
    requestCount += 1
    request.resume()
    response.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    })
    const chunk = { id: `market-screenshot-${requestCount}`, model: 'screenshot-local', choices: [{ index: 0, delta: { role: 'assistant', content: '离线测试回复' }, finish_reason: null }] }
    const finish = { id: chunk.id, model: chunk.model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, prompt_cache_hit_tokens: 0 } }
    response.write(`data: ${JSON.stringify(chunk)}\n\n`)
    response.write(`data: ${JSON.stringify(finish)}\n\n`)
    response.end('data: [DONE]\n\n')
  })
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolvePromise)
  })
  return {
    requests: () => requestCount,
    close: async () => await new Promise(resolvePromise => server.close(resolvePromise)),
  }
}

async function launchBrowser(headed) {
  try {
    return await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome', headless: !headed })
  } catch (error) {
    throw new Error(`Chrome could not be launched. Install Google Chrome or set PLAYWRIGHT_CHANNEL to an installed Playwright channel.\n${error instanceof Error ? error.message : error}`)
  }
}

async function dismissOnboarding(page) {
  const labels = [/^(继续|Continue)$/i, /^(稍后配置|Configure later)$/i, /^(跳过|Skip)$/i, /^(稍后|Later)$/i]
  // A fresh DSH profile currently shows a welcome notice followed by model
  // onboarding. Keep this loop copy-based so minor modal sequencing changes do
  // not make the screenshot job click through the overlay with force.
  let idleRounds = 0
  for (let round = 0; round < 8; round += 1) {
    let clicked = false
    for (const label of labels) {
      const buttons = page.getByRole('button', { name: label })
      for (let index = await buttons.count() - 1; index >= 0; index -= 1) {
        const button = buttons.nth(index)
        if (await button.isVisible().catch(() => false) && await button.isEnabled().catch(() => false)) {
          await button.click()
          await page.waitForTimeout(750)
          clicked = true
          break
        }
      }
      if (clicked) break
    }
    if (clicked) idleRounds = 0
    else {
      idleRounds += 1
      if (idleRounds >= 2) return
      await page.waitForTimeout(750)
    }
  }
}

async function openGeneralSettings(page, target) {
  await dismissOnboarding(page)
  const settings = page.locator('button[aria-haspopup="dialog"]').filter({ hasText: /设置|Settings/i }).last()
  if (!await settings.isVisible().catch(() => false)) {
    throw new Error(`${target.id}: Settings trigger was not found`)
  }
  await settings.click()
  const dialog = page.getByRole('dialog').last()
  await dialog.waitFor({ state: 'visible', timeout: 10_000 })

  const general = dialog.getByRole('button', { name: /通用设置|General/i }).first()
  if (await general.isVisible().catch(() => false)) await general.click()
  await dialog.getByText(target.readyText).first().waitFor({ state: 'visible', timeout: 15_000 })
  return dialog
}

async function activateTargetTheme(page, target) {
  if (target.selectionText === undefined) return
  const dialog = await openGeneralSettings(page, target)
  const choice = dialog.getByRole('button', { name: target.selectionText }).first()
  await choice.waitFor({ state: 'visible', timeout: 10_000 })
  await choice.click()
  if (target.expectedTheme !== undefined) {
    await page.waitForFunction(expected => document.body.dataset.dsTheme === expected, target.expectedTheme, { timeout: 10_000 })
  }
  await dialog.getByRole('button', { name: /关闭|Close/i }).last().click()
  await dialog.waitFor({ state: 'hidden', timeout: 10_000 })
}

async function capturePage(page, path) {
  await mkdir(dirname(path), { recursive: true })
  await page.screenshot({ path, animations: 'disabled' })
  console.log(`[captured] ${relative(root, path)}`)
}

async function callHost(page, method, payload) {
  const response = await page.evaluate(async ({ method, payload }) => {
    const rpcId = `market-screenshot-${crypto.randomUUID()}`
    const request = await fetch(`/api/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId, method, payload }),
    })
    return { status: request.status, body: await request.json() }
  }, { method, payload })
  if (response.status !== 200 || response.body?.result?.ok !== true) {
    throw new Error(`${method} failed (${JSON.stringify(response)})`)
  }
  return response.body.result.value
}

async function configureLocalMockModel(page, mockUrl) {
  await callHost(page, 'settings.mutate', {
    ns: 'llm-deepseek',
    ops: [
      { op: 'set', path: ['baseURL'], value: mockUrl },
      { op: 'set', path: ['thinking'], value: 'disabled' },
      { op: 'set', path: ['reasoningEffort'], value: 'off' },
      { op: 'set', path: ['maxTokens'], value: 64 },
      { op: 'set', path: ['models'], value: [{ id: 'screenshot-local', name: 'Local Screenshot Mock', contextWindow: 4096, maxTokens: 64 }] },
    ],
  })
  await callHost(page, 'credentials.set', { ref: 'DEEPSEEK_API_KEY', value: 'local-screenshot-mock-only' })
}

async function registerCaptureWorkspace(page, target) {
  try {
    return await callHost(page, 'workspace.create', { path: root })
  } catch (error) {
    throw new Error(`${target.id}: could not register disposable capture workspace (${error instanceof Error ? error.message : error})`)
  }
}

async function createTestConversation(page, target, mockUrl) {
  let composer
  // A new disposable DSH home has no workspace yet, so the real composer is
  // present but disabled. Register this public market checkout through the
  // local Host RPC, reload the client baseline, then select it through the UI.
  const disabledComposer = page.getByPlaceholder(/选择一个工作区开始|Select a workspace to start/i).first()
  let workspaceResult
  if (await disabledComposer.isVisible().catch(() => false)) {
    await configureLocalMockModel(page, mockUrl)
    workspaceResult = await registerCaptureWorkspace(page, target)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1_000)
    await dismissOnboarding(page)
    await page.waitForTimeout(750)
    composer = page.getByPlaceholder(/给智能体发消息|Message the agent/i).first()
    if (!await composer.isVisible().catch(() => false)) {
      const chooser = page.getByRole('button', { name: /选择工作区|Choose workspace/i }).first()
      await chooser.click({ timeout: 5_000 })
      const workspace = page.getByRole('menuitem', { name: 'dsh-skin-market', exact: true })
      await workspace.click({ timeout: 5_000 })
    }
  }
  composer = page.getByPlaceholder(/给智能体发消息|Message the agent|描述你想要构建的内容|Describe what you want to build/i).first()
  await composer.waitFor({ state: 'visible', timeout: 15_000 })
  if (!await composer.isEnabled()) throw new Error(`${target.id}: conversation composer is disabled after selecting capture workspace`)
  const workspaceId = workspaceResult?.workspace?.workspaceId
  const workspaceList = await callHost(page, 'workspace.list', {})
  const sessionId = workspaceList.items?.find(item => item.workspaceId === workspaceId)?.sessionIds?.[0]
  if (!sessionId) throw new Error(`${target.id}: disposable workspace did not create a session`)
  await callHost(page, 'session.selectModel', { sessionId, provider: 'deepseek-official', model: 'screenshot-local', reasoningEffort: 'off' })
  await composer.fill('test')
  await composer.press('Enter')
  await page.getByRole('paragraph').filter({ hasText: /^离线测试回复$/ }).waitFor({ state: 'visible', timeout: 15_000 })
  await callHost(page, 'session.rename', { sessionId, title: 'test' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1_000)
  await dismissOnboarding(page)
  const newSession = page.locator('button').filter({ hasText: /新会话|New session/i }).first()
  await newSession.click({ timeout: 10_000 })
  await page.waitForTimeout(750)
  const history = page.getByRole('treeitem').filter({ hasText: /test/ }).first()
  await history.click({ timeout: 10_000 })
  await page.getByRole('paragraph').filter({ hasText: /^离线测试回复$/ }).waitFor({ state: 'visible', timeout: 15_000 })
  return { sessionId }
}

async function clickNewSession(page) {
  const newSession = page.locator('button').filter({ hasText: /新会话|New session/i }).first()
  await newSession.click({ timeout: 10_000 })
  await page.waitForTimeout(750)
}

async function openExistingTestConversation(page, target) {
  const history = page.getByRole('treeitem').filter({ hasText: /test/ }).first()
  await history.click({ timeout: 10_000 })
  await page.getByRole('paragraph').filter({ hasText: /^离线测试回复$/ }).waitFor({ state: 'visible', timeout: 15_000 })
  const userMessage = page.getByText('test', { exact: true }).last()
  await userMessage.waitFor({ state: 'visible', timeout: 10_000 })
  if (!await history.getAttribute('aria-selected').catch(() => null)) {
    // Some DSH versions do not expose aria-selected. The visible fixed reply is
    // the compatibility assertion, so this branch intentionally does nothing.
  }
  console.log(`[history:reused] ${target.id}`)
}

async function ensureHistoryTemplate(options) {
  const templateDir = safeChild(options.cacheDir, join(options.cacheDir, 'history-template-v1'))
  const markerPath = join(templateDir, 'market-screenshot-history.json')
  try {
    const marker = JSON.parse(await readFile(markerPath, 'utf8'))
    if (marker.version === 1 && marker.prompt === 'test' && marker.tokenSpend === 0 && marker.externalModelRequestSent === false) {
      console.log('[history:template] reused')
      return { templateDir, seededNow: false, seedMockRequests: marker.localMockRequests ?? 0 }
    }
  } catch { /* seed or repair the local disposable template */ }

  await rm(templateDir, { recursive: true, force: true })
  await mkdir(templateDir, { recursive: true })
  await installBaseOffline(templateDir)

  const port = options.portBase + 80
  const mockPort = options.portBase + 180
  const url = `http://127.0.0.1:${port}`
  const mockUrl = `http://127.0.0.1:${mockPort}`
  const logStream = createWriteStream(join(templateDir, 'history-seed.log'))
  const server = spawn('dsh', ['web', '--port', String(port)], {
    cwd: root,
    env: { ...process.env, DSH_HOME: templateDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  server.stdout.pipe(logStream, { end: false })
  server.stderr.pipe(logStream, { end: false })

  let browser
  let mockModel
  try {
    mockModel = await startMockModelServer(mockPort)
    await waitForServer(url, server)
    browser = await launchBrowser(options.headed)
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, locale: 'zh-CN', colorScheme: 'dark' })
    let promptRequests = 0
    await context.route('**/api/session.prompt', async route => {
      promptRequests += 1
      await route.continue()
    })
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(2_000)
    await dismissOnboarding(page)
    await createTestConversation(page, { id: 'history-template' }, mockUrl)
    if (promptRequests !== 1) throw new Error(`history template expected exactly one local prompt, received ${promptRequests}`)
    if (mockModel.requests() < 1) throw new Error('history template mock did not receive the seed turn')
    await context.close()
    const marker = {
      version: 1,
      createdAt: new Date().toISOString(),
      prompt: 'test',
      reply: '离线测试回复',
      externalModelRequestSent: false,
      localMockRequests: mockModel.requests(),
      tokenSpend: 0,
    }
    await writeFile(markerPath, `${JSON.stringify(marker, null, 2)}\n`)
    console.log(`[history:template] seeded with ${mockModel.requests()} zero-usage loopback request(s)`)
    return { templateDir, seededNow: true, seedMockRequests: mockModel.requests() }
  } catch (error) {
    await rm(templateDir, { recursive: true, force: true })
    throw error
  } finally {
    await browser?.close().catch(() => {})
    await stopServer(server)
    await mockModel?.close().catch(() => {})
    logStream.end()
  }
}

async function captureTarget(options, workRoot, historyTemplate, target, index) {
  const archive = await requireArchive(options.cacheDir, target, options.downloadMissing)
  const sourceDir = await extractSource(workRoot, archive, target)
  const dshHome = safeChild(workRoot, join(workRoot, 'dsh-homes', target.id))
  await rm(dshHome, { recursive: true, force: true })
  await cp(historyTemplate.templateDir, dshHome, { recursive: true })
  await installOffline(dshHome, sourceDir, target)

  const port = options.portBase + index
  const url = `http://127.0.0.1:${port}`
  const logDir = safeChild(workRoot, join(workRoot, 'logs'))
  await mkdir(logDir, { recursive: true })
  const logFile = join(logDir, `${target.id}.log`)
  const logStream = createWriteStream(logFile)
  const server = spawn('dsh', ['web', '--port', String(port)], {
    cwd: root,
    env: { ...process.env, DSH_HOME: dshHome },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  server.stdout.pipe(logStream, { end: false })
  server.stderr.pipe(logStream, { end: false })

  let browser
  try {
    await waitForServer(url, server)
    browser = await launchBrowser(options.headed)
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
      locale: 'zh-CN',
      colorScheme: 'dark',
    })
    let promptRequests = 0
    await context.route('**/api/session.prompt', async route => {
      promptRequests += 1
      await route.continue()
    })
    await context.addInitScript(entries => {
      for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value)
    }, target.localStorage)
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(2_000)
    await dismissOnboarding(page)
    await page.waitForTimeout(500)
    await activateTargetTheme(page, target)
    const screenshotDir = join(options.outputDir, `${target.owner}__${target.repo}`, target.commit)
    const screenshots = {
      home: join(screenshotDir, 'home.png'),
      conversation: join(screenshotDir, 'conversation.png'),
      settings: join(screenshotDir, 'settings.png'),
    }
    await clickNewSession(page)
    await capturePage(page, screenshots.home)
    await openExistingTestConversation(page, target)
    await capturePage(page, screenshots.conversation)
    if (promptRequests !== 0) throw new Error(`${target.id}: target capture unexpectedly sent ${promptRequests} prompt request(s)`)
    await openGeneralSettings(page, target)
    await page.waitForTimeout(750)
    await capturePage(page, screenshots.settings)
    const title = await page.title()
    const bodyText = await page.locator('body').innerText()
    if (!target.readyText.test(bodyText)) throw new Error(`${target.id}: screenshot marker disappeared`)
    await context.close()
    return {
      id: target.id,
      owner: target.owner,
      repo: target.repo,
      package: target.package,
      version: target.version,
      commit: target.commit,
      screenshots,
      title,
      conversation: {
        historySeedReused: true,
        historySeededNow: historyTemplate.seededNow,
        messageSent: false,
        prompt: 'test',
        historyReopened: true,
        externalModelRequestSent: false,
        localMockRequests: 0,
        seedMockRequests: historyTemplate.seedMockRequests,
        tokenSpend: 0,
        method: 'reused-zero-token-history-template',
      },
    }
  } finally {
    await browser?.close().catch(() => {})
    await stopServer(server)
    logStream.end()
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const chosen = selectedTargets(options.skinIds)
  await mkdir(options.cacheDir, { recursive: true })
  await mkdir(options.outputDir, { recursive: true })

  if (options.prepareOnly) {
    for (const target of chosen) await downloadArchive(options.cacheDir, target)
    console.log(`Prepared ${chosen.length} pinned archive(s). Capture can now run offline.`)
    return
  }

  const workRoot = safeChild(options.cacheDir, join(options.cacheDir, 'work'))
  await mkdir(workRoot, { recursive: true })
  const historyTemplate = await ensureHistoryTemplate(options)
  const results = []
  try {
    for (let index = 0; index < chosen.length; index += 1) {
      results.push(await captureTarget(options, workRoot, historyTemplate, chosen[index], index))
    }
    const report = {
      generatedAt: new Date().toISOString(),
      offlineCapture: true,
      viewport: { width: 1440, height: 1000 },
      screenshots: results.map(result => ({
        ...result,
        screenshots: Object.fromEntries(Object.entries(result.screenshots).map(([view, path]) => [view, relative(root, path)])),
      })),
    }
    await writeFile(join(options.outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
    console.log(`Captured ${results.length} screenshot(s).`)
  } finally {
    if (!options.keepWork) await rm(workRoot, { recursive: true, force: true })
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
