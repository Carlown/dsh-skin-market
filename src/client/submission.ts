export const REGISTRY_REPOSITORY = 'https://github.com/kingOfSoySauce/dsh-skin-market'
export const REGISTRY_PATH = 'registry/skins'

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
6. fork/clone 目标目录仓库，新建分支；按照 registry/skin.schema.json，在 ${REGISTRY_PATH} 下新增一个独立 YAML。不要修改无关文件，也不要覆盖已有条目。
7. 在目标目录仓库根目录运行 npm run registry 和相关测试。不得安装到我的真实 DSH profile，不得读取 .env、凭据、聊天记录或工作区外的私密文件。
8. 检查 git diff，提交变更并向 ${REGISTRY_REPOSITORY} 创建 PR。PR 标题使用“feat(registry): add <皮肤名>”，正文列出仓库、子包、版本、commit、许可证、预览来源、兼容性、自动检查结果和仍需人工确认的风险。
9. 创建 PR 后返回 PR 链接；如果没有 GitHub 权限或需要登录，只准备好分支、commit 和可复制的 PR 内容，明确告诉我下一步。

收录不等于安全认证。不要声称该皮肤已被 DSH 官方、安全团队或市场背书。`
}

export function createSkinInstallPrompt(skin: CatalogSkin): string {
  const buildApproval = skin.install.allowBuild === undefined
    ? ''
    : `\n- 这个固定版本包含 prepare 构建脚本。只允许精确构件键 \`${skin.install.allowBuild}\`：在 profile 的 pnpm-workspace.yaml 里合并 \`allowBuilds:\n    '${skin.install.allowBuild}': true\`，不得开启 dangerouslyAllowAllBuilds。`
  return `请帮我把下面这个已固定版本的 DSH Web 皮肤安装到 web profile，并完成验证。\n\n- 仓库：${skin.repo}\n- 安装目标：${skin.install.target}\n- package：${skin.package}\n- loader rowId：${skin.rowId ?? skin.package}\n- 版本：${skin.install.version}\n- commit：${skin.install.commit}${buildApproval}\n\n要求：\n1. 不要改成 main、HEAD 或最新版本，必须使用上面的完整 commit。\n2. 运行 DSH 的 profile 插件安装命令；如果是只有 dsh.client 的皮肤，幂等地把上面的 package 和 rowId 注册到 web profile 的 cordis.patch.yml。\n3. 不要读取 .env、凭据或聊天记录；不要放宽其他包的构建权限。\n4. 安装后确认 profile package.json 中存在该依赖、node_modules 中的 package.json 声明了 dsh.client，并确认 loader 注册项存在。\n5. 告诉我是否需要重启 DSH Web；不要替我安装其他皮肤。`
}

export function createSkinInstallCommand(skin: CatalogSkin): string {
  return `dsh plugin --profile web add '${skin.install.target}'`
}
import type { CatalogSkin } from './types.ts'
