export const MARKET_REPOSITORY = 'https://github.com/kingOfSoySauce/dsh-skin-market'

export const MARKET_PROMPT = `请帮我把这个插件安装到 DSH 的 web profile：${MARKET_REPOSITORY}。安装完成后告诉我如何重启 DSH Web，并确认可以从“设置 → 皮肤市场”打开它。不要替我安装任何皮肤。`

export function skinPrompt(repository: string): string {
  return `帮我安装这个皮肤：${repository}`
}
