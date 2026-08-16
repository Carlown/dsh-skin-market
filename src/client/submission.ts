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

export function createSubmissionPrompt(repositoryInput: string): string {
  const repository = normalizeGitHubRepository(repositoryInput)
  if (repository === null) return ''

  return `请把我的 DSH 皮肤提交到 DSH Skin Market。

皮肤仓库：${repository}
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
