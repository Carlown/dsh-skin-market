import { createDshPluginAddCommand } from '../src/install-command.ts'

export const MARKET_REPOSITORY = 'https://github.com/kingOfSoySauce/dsh-skin-market'
export const MARKET_PUBLIC_URL = 'https://kingofsoysauce.github.io/dsh-skin-market/'
export const MARKET_CLI_COMMAND = createDshPluginAddCommand('dsh-skin-market@latest')
export const CLI_INSTALL_WARNING = '安装前请确保已关闭其他皮肤插件，避免全局样式冲突；也可以复制提示词，让 Agent 先检查冲突再安装。'

export const MARKET_PROMPT = `请把 dsh-skin-market 安装到 DSH 的 web profile。不能先安装再检查，必须严格按以下顺序执行：

1. 安装前只读检查 web profile 的 package.json（dependencies 与 dsh.profile.bundles）、profile 的 cordis.patch.yml 和 $DSH_HOME/cordis.patch.yml（如有）。
2. 从当前启用的 bundles 中识别皮肤、主题或外观插件：排除 @deepseek-ai/dsh-base、@deepseek-ai/dsh-web-app 和 dsh-skin-market；读取候选 package.json 的名称、描述、dsh.client/dsh.bundle 声明，必要时再读 README。无法确定的候选先列出包名和描述。
3. 如果发现已启用的皮肤插件，列出它们并停在安装前，提醒我先停用以避免冲突；未经我确认不得修改任何 profile 文件，也不得执行安装。
4. 如果没有冲突，明确说“未检测到已启用的皮肤插件”，然后直接执行：
${MARKET_CLI_COMMAND}
5. 安装后读取 web profile 的 package.json，确认 dependencies 和 dsh.profile.bundles 中都有 dsh-skin-market；缺失则报告安装或注册失败。
6. 告诉我如何重启 DSH Web，并确认重启后可从“设置 → 皮肤市场”打开。不要替我安装任何皮肤。

仓库：${MARKET_REPOSITORY}`

export function skinPrompt(repository: string, compatibilityVerified = true, installTarget?: string): string {
  const target = installTarget ?? repository
  const compatibilityStep = compatibilityVerified
    ? ''
    : '\n1. 维护者尚未声明可验证的 DSH 兼容范围。先只读检查仓库，确认它兼容当前 DSH Web 版本并核对安装方式；先告诉我结论和风险，等待我确认后再安装，不要直接安装。\n'
  return `请安装这个 DSH Web 皮肤：${repository}\n- 固定安装目标：${target}\n- 安装命令：${createDshPluginAddCommand(target)}\n${compatibilityStep}
必须先检查冲突再安装：
1. 只读检查 web profile 的 package.json（dependencies 与 dsh.profile.bundles）、profile 的 cordis.patch.yml 和 $DSH_HOME/cordis.patch.yml（如有）。
2. 从当前启用的 bundles 中识别其他皮肤、主题或外观插件；排除 @deepseek-ai/dsh-base、@deepseek-ai/dsh-web-app、dsh-skin-market 和本次目标仓库或 package。读取候选 package.json 的名称、描述、dsh.client/dsh.bundle 声明，必要时再读 README。
3. 发现其他已启用的皮肤插件时，列出它们并停在安装前，提醒我先停用；未经我确认不得修改 profile，也不得执行安装。
4. 没有冲突时，明确说“未检测到其他已启用的皮肤插件”，再执行上面的固定安装命令。
5. 安装后验证 profile package.json 的 dependencies 与 dsh.profile.bundles，以及目标 package 的 dsh.client/dsh.bundle 声明和 loader 注册项；缺失则报告失败。
6. 告诉我如何重启 DSH Web。不要替我安装、停用或卸载其他皮肤。`
}

export function skinCommand(installTarget: string): string {
  return createDshPluginAddCommand(installTarget)
}
