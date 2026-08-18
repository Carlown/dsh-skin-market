const DISPLAY_PREFIXES = [
  /^\s*DSKIN\s*[·•]\s*DeepSeek\s+Harness\s*[（(]\s*DSH\s*[）)]\s*/i,
  /^\s*DSH\s*[（(]\s*DeepSeek\s+Harness\s*[）)]\s*的\s*/i,
  /^\s*Third-party\s+DSH\s+WebUI\s+/i,
  /^\s*A\s+DSH\s+skin\s+plugin\s+that\s+/i,
  /^\s*DSH\s+皮肤插件\s*[:：]\s*/i,
  /^\s*DSH\s+Web(?:UI)?\s*[:：-]?\s*/i,
  /^\s*DeepSeek\s+Harness\s*[:：-]?\s*/i,
  /^\s*DS\s+Harness\s*[:：-]?\s*/i,
  /^\s*DSH\b\s*[:：-]?\s*/i,
]

const LEADING_SEPARATORS = /^[\s:：\-–—|·•,，。.!！？]+/

/** Remove catalog boilerplate from the title shown to users without changing the source description. */
export function displayTitle(value: string): string {
  const original = value.trim()
  let current = original
  let changed = true
  while (changed && current.length > 0) {
    changed = false
    for (const pattern of DISPLAY_PREFIXES) {
      const next = current.replace(pattern, '')
      if (next !== current) {
        current = next.replace(LEADING_SEPARATORS, '').trim()
        changed = true
        break
      }
    }
  }
  return current || original
}

export function githubRepoLabel(repo: string): string {
  return repo.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '')
}
