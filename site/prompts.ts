export const MARKET_REPOSITORY = 'https://github.com/kingOfSoySauce/dsh-skin-market'
export const MARKET_PUBLIC_URL = 'https://kingofsoysauce.github.io/dsh-skin-market/'

export const MARKET_PROMPT = `请帮我把这个插件安装到 DSH 的 web profile：${MARKET_REPOSITORY}。安装完成后告诉我如何重启 DSH Web，并确认可以从“设置 → 皮肤市场”打开它。不要替我安装任何皮肤。`

export function skinPrompt(repository: string, compatibilityVerified = true): string {
  const prompt = `帮我安装这个皮肤：${repository}`
  if (compatibilityVerified) return prompt

  return `${prompt}\n\n维护者尚未声明可验证的 DSH 兼容范围。请先只读检查仓库，确认它兼容我当前的 DSH Web 版本并核对安装方式；先告诉我检查结论和风险，等待我确认后再安装，不要直接安装。`
}
