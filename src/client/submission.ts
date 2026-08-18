export const REGISTRY_REPOSITORY = 'https://github.com/kingOfSoySauce/dsh-skin-market'
export const REGISTRY_PATH = 'registry/skins'
export const CLI_INSTALL_WARNING = '安装前请确保已关闭其他皮肤插件，避免全局样式冲突；也可以复制提示词，让 Agent 先检查冲突再安装。'

export function normalizeGitHubRepository(value: string): string | null {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.hostname !== 'github.com') return null
    const parts = url.pathname.replace(/\.git$/, '').split('/').filter(Boolean)
    if (parts.length !== 2) return null
    return `https://github.com/${parts[0]}/${parts[1]}`
  } catch {
    return null
  }
}

export function createSubmissionPrompt(repositoryInput?: string): string {
  const repository = repositoryInput === undefined ? null : normalizeGitHubRepository(repositoryInput)
  if (repositoryInput !== undefined && repository === null) return ''
  const repositoryLine = repository === null
    ? '皮肤仓库：如果当前工作区就是待提交的皮肤仓库，请确认它的公开 GitHub remote；否则先向我索要公开 GitHub 仓库地址。'
    : `皮肤仓库：${repository}`

  return `请把我的 DSH 皮肤提交到 DSH Skin Market。

${repositoryLine}
目标目录仓库：${REGISTRY_REPOSITORY}
目录路径：${REGISTRY_PATH}

请自主完成以下工作：
1. 只用只读方式检查皮肤仓库；识别单包或 monorepo 子包，读取 package.json、DSH bundle/client 声明、cordis.patch.yml、README、许可证、预览图和 release/tag。
2. 确认它确实是可安装的 DSH Web 皮肤。不要仅凭仓库名、README 文案或 dsh-plugin topic 判定。
3. 解析准备收录版本对应的完整 40 位 commit SHA。安装目标必须固定到该 SHA；禁止使用 main、master、HEAD 或其他可变分支。
4. 不要猜测皮肤名、包名、rowId、许可证、兼容版本或素材授权。缺少关键信息时先列出缺项，不要创建虚假条目。
5. 预览图只选仓库内真实截图，使用固定 commit 的 GitHub raw HTTPS 地址；不要使用 SVG、data URI、任意第三方图床或带追踪参数的 URL。
6. fork/clone 目标目录仓库，新建分支；按照 registry/skin.schema.json，在 ${REGISTRY_PATH} 下只新增一个独立 YAML。不要修改或提交生成的 data/catalog.json，也不要覆盖已有条目。
7. 在目标目录仓库根目录运行 npm run registry:check 和相关测试。这个检查只验证 registry，不会改写生成文件。不得安装到我的真实 DSH profile，不得读取 .env、凭据、聊天记录或工作区外的私密文件。
8. 检查 git diff --name-only，确认变更只包含 ${REGISTRY_PATH}/<条目文件>.yml；提交变更并向 ${REGISTRY_REPOSITORY} 创建 PR。PR 标题使用“feat(registry): add <皮肤名>”，正文列出仓库、子包、版本、commit、许可证、预览来源、兼容性、自动检查结果和仍需人工确认的风险。
9. 创建 PR 后返回 PR 链接；如果没有 GitHub 权限或需要登录，只准备好分支、commit 和可复制的 PR 内容，明确告诉我下一步。

收录不等于安全认证。不要声称该皮肤已被 DSH 官方、安全团队或市场背书。`
}

export function createSkinInstallPrompt(skin: CatalogSkin): string {
  const buildApproval = skin.install.allowBuild === undefined
    ? ''
    : `\n- 这个固定版本包含 prepare 构建脚本。只允许精确构件键 \`${skin.install.allowBuild}\`：在 profile 的 pnpm-workspace.yaml 里合并 \`allowBuilds:\n    '${skin.install.allowBuild}': true\`，不得开启 dangerouslyAllowAllBuilds。`
  const command = createSkinInstallCommand(skin)
  return `请把下面这个已固定版本的 DSH Web 皮肤安装到 web profile。必须先完成只读冲突检查，确认可以继续后再安装。\n\n- 仓库：${skin.repo}\n- 安装目标：${skin.install.target}\n- 安装命令：${command}\n- package：${skin.package}\n- loader rowId：${skin.rowId ?? skin.package}\n- 版本：${skin.install.version}\n- commit：${skin.install.commit}${buildApproval}\n\n严格按以下顺序执行：\n1. 不要改成 main、HEAD 或最新版本，必须使用上面的完整 commit。\n2. 安装前只读检查 web profile 的 package.json（dependencies 与 dsh.profile.bundles）、profile 的 cordis.patch.yml 和 $DSH_HOME/cordis.patch.yml（如有）。不要读取 .env、凭据或聊天记录。\n3. 从当前启用的 bundles 中识别其他皮肤、主题或外观插件：排除 @deepseek-ai/dsh-base、@deepseek-ai/dsh-web-app、dsh-skin-market 和本次目标 package ${skin.package}；读取候选 package.json 的名称、描述、dsh.client/dsh.bundle 声明，必要时再读 README。无法确定的候选先列出包名和描述。\n4. 如果发现其他已启用的皮肤插件，列出它们并停在安装前，提醒我先在“设置 → 皮肤市场”或 profile 的 cordis.patch.yml 中停用；未经我确认不得修改任何 profile 文件，也不得执行安装。\n5. 如果没有冲突，明确说“未检测到其他已启用的皮肤插件”，然后执行上面的固定安装命令；不要替我安装、停用或卸载其他皮肤。\n6. 如果目标只有 dsh.client，幂等地确认上面的 package 和 rowId 已注册到 web profile 的 cordis.patch.yml；不要放宽其他包的构建权限。\n7. 安装后验证 profile package.json 的 dependencies 和 dsh.profile.bundles、node_modules 中目标 package.json 的 dsh.client/dsh.bundle 声明，以及 loader rowId 注册项。任一缺失都要报告为安装或注册失败。\n8. 告诉我如何重启 DSH Web 使皮肤生效。`
}

export function createSkinInstallCommand(skin: CatalogSkin): string {
  return `dsh plugin --profile web add '${skin.install.target}'`
}
import type { CatalogSkin } from './types.ts'
