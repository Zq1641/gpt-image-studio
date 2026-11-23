import type { Skill } from './types'

// Skill 胶囊 token：`⟦skill:NAME⟧`。选用生僻括号对做定界，
// 用户正常输入几乎不可能敲出来，回解析不会误伤正文。
// NAME 内不允许 `⟧` / `]` / 换行，清洗规则 main + renderer 共用同一份。
export const SKILL_TOKEN_RE = /⟦skill:([^\]⟧\r\n]+)⟧/g

export function normalizeSkillName(input: unknown): string {
  const s = typeof input === 'string' ? input : ''
  // `"`/`'` 去掉：名字会写进 HTML 属性 data-skill="NAME"，留引号会打破标签。
  // `&`/`<>` 去掉：渲染前要过 HTML escape，留着会导致胶囊匹配不上（回解析错位）。
  return s.replace(/[\r\n⟦⟧\]"'&<>]/g, '').trim().slice(0, 60)
}

// 单个 content 上限 200KB（约 10 万汉字），超限整条丢弃，
// 防止 settings.json 体积爆炸拖慢每次启动加载。
export const SKILL_CONTENT_MAX = 200_000

export function newSkillId(): string {
  try {
    // 浏览器/Electron 渲染进程：优先用 Web Crypto
    const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto
    if (c?.randomUUID) return c.randomUUID()
  } catch { /* fall through */ }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

// 与 normalizeModelList 同风格的清洗：去空/超长/超大 → 按名去重 → 兜底 []。
export function normalizeSkillList(input: unknown): Skill[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const out: Skill[] = []
  for (const x of input) {
    if (!x || typeof x !== 'object') continue
    const r = x as Partial<Skill>
    const name = normalizeSkillName(r.name)
    const content = typeof r.content === 'string' ? r.content : ''
    if (!name || !content.trim() || content.length > SKILL_CONTENT_MAX) continue
    if (seen.has(name)) continue
    seen.add(name)
    out.push({
      id: typeof r.id === 'string' && r.id ? r.id : newSkillId(),
      name,
      content,
      sourceName: typeof r.sourceName === 'string' ? r.sourceName : '',
      charCount: typeof r.charCount === 'number' ? r.charCount : content.length,
      createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
    })
  }
  return out
}

// 从文件名推默认 skill 名：去扩展名 → 清洗 → 为空则回退。
export function skillNameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  return normalizeSkillName(base) || '未命名Skill'
}
