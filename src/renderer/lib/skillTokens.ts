import type { Skill } from '@shared/types'

// Skill 胶囊的 VF 标识：渲染层红色胶囊 ↔ 纯文本 token 的双向映射。
// 文本模型里 skill 以 `⟦skill:NAME⟧` 存在；显示时整段替换成红色胶囊。
export const SKILL_CLS = 'skill-chip'

// 生成时展开：把 token 按 skill 名替换成全文。
// - 未知名字（skill 已被删）：整段删掉 + 报 errors（Generate 按钮据此禁用）。
// - 重复引用同一 skill：只拼一次全文，后续重复处删掉（避免 prompt 膨胀）。
export interface SkillResolveResult {
  text: string
  referenced: string[]
  errors: string[]
}

export function resolveSkillPrompt(raw: string, skills: Skill[]): SkillResolveResult {
  const errors: string[] = []
  const referenced: string[] = []
  const seen = new Set<string>()
  const byName = new Map(skills.map((s) => [s.name, s]))
  // SKILL_TOKEN_RE 是全局正则（/g），用 .test 会受 lastIndex 污染，这里手写匹配。
  const TOKEN_RE = /⟦skill:([^\]⟧\r\n]+)⟧/g
  const text = raw.replace(TOKEN_RE, (m, name: string) => {
    const skill = byName.get(name)
    if (!skill) {
      errors.push(`引用的 Skill「${name}」已不存在，请删除红色胶囊后重试`)
      return ''
    }
    if (seen.has(name)) return ''
    seen.add(name)
    referenced.push(name)
    return `\n\n【Skill：${skill.name}】\n${skill.content}\n`
  })
  return { text: text.replace(/[ \t]{2,}/g, ' ').trim(), referenced, errors }
}

// 校验：编辑器里的哪些 skill token 已经失效（右上角删掉后输入框还留着胶囊）。
export function missingSkillNames(raw: string, skills: Skill[]): string[] {
  const names = new Set(skills.map((s) => s.name))
  const missing = new Set<string>()
  const TOKEN_RE = /⟦skill:([^\]⟧\r\n]+)⟧/g
  let m: RegExpExecArray | null
  while ((m = TOKEN_RE.exec(raw)) !== null) {
    const name = m[1]
    if (name && !names.has(name)) missing.add(name)
  }
  return Array.from(missing)
}

// 文本里实际引用的 skill 名（去重保序），历史 params 行 `· N skill` 计数用。
export function skillNamesIn(raw: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const TOKEN_RE = /⟦skill:([^\]⟧\r\n]+)⟧/g
  let m: RegExpExecArray | null
  while ((m = TOKEN_RE.exec(raw)) !== null) {
    const name = m[1]
    if (name && !seen.has(name)) {
      seen.add(name)
      out.push(name)
    }
  }
  return out
}

// 只读展示用：把 token 还原成 `◆ NAME` 纯文本。
// Archive 列表、删除确认框走这个——直接展示 `⟦skill:…⟧` 会吓到用户。
export function displayPrompt(raw: string): string {
  return raw.replace(/⟦skill:([^\]⟧\r\n]+)⟧/g, (_m, n) => `◆ ${n}`).trim()
}
