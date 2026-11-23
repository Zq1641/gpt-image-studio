import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { type AppSettings, DEFAULT_MODELS, DEFAULT_SETTINGS, ensureActive, newPresetId, normalizePreset, type Preset } from './presets'
import { normalizeSkillList, normalizeSkillName, newSkillId, SKILL_CONTENT_MAX } from '../shared/skills'

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): AppSettings {
  const p = settingsPath()
  if (!existsSync(p)) return ensureActive({ ...DEFAULT_SETTINGS })
  try {
    const raw = readFileSync(p, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppSettings> & {
      baseUrl?: string; apiKey?: string; model?: string
      imageFieldName?: 'image' | 'images' | 'image_url'
      sizeMode?: 'computed' | 'square' | 'omit'
      sendAspectRatio?: boolean
    }
    // 兼容 v1 单字段：把旧版 baseUrl/apiKey/model 全部塞到默认预设里
    if (parsed.presets == null && (parsed.baseUrl || parsed.apiKey)) {
      const legacy: Preset = normalizePreset({
        id: 'default',
        name: '默认预设',
        baseUrl: parsed.baseUrl ?? '',
        apiKey: parsed.apiKey ?? '',
        pricePerImage: 0,
        model: parsed.model || 'gpt-image-2',
        imageFieldName: (parsed.imageFieldName ?? 'image') as Preset['imageFieldName'],
        sizeMode: (parsed.sizeMode ?? 'computed') as Preset['sizeMode'],
        sendAspectRatio: parsed.sendAspectRatio ?? true,
      })
      return ensureActive({ ...DEFAULT_SETTINGS, presets: [legacy], activePresetId: legacy.id })
    }
    // 兼容旧版 settings.json：normalizeModels 缺字段/脏数据时都补默认列表
    const models = normalizeModels(parsed.models)
    const merged: AppSettings = { ...DEFAULT_SETTINGS, ...(parsed as Partial<AppSettings>), models }
    const ensured = ensureActive(merged)
    // 关键修复：若旧盘上 models 字段缺失/非法，ensureActive 只在内存里补了默认，
    // 不写盘会导致“每次加载看起来有 4 个、但删除永远删不掉”的幽灵列表。
    // 这里一次性回填写盘，后续增删就有稳定的基准了。
    if (!Array.isArray(parsed.models)) {
      try { writeSettings(ensured) } catch { /* ignore */ }
    }
    return ensured
  } catch {
    return ensureActive({ ...DEFAULT_SETTINGS })
  }
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const cur = loadSettings()
  // saveSettings 是全量 patch 合并：若调用方没带 models，必须保留当前盘上的，
  // 否则一次“只改 timeout”之类的保存就会把用户删过的模型又恢复出来。
  const next = ensureActive({
    ...cur,
    ...patch,
    models: patch.models === undefined ? cur.models : normalizeModels(patch.models),
  })
  writeSettings(next)
  return next
}

export function addPreset(input: Omit<Preset, 'id'>): AppSettings {
  const cur = loadSettings()
  const p: Preset = normalizePreset({ ...input, id: newPresetId() })
  const next: AppSettings = ensureActive({ ...cur, presets: [...cur.presets, p] })
  writeSettings(next)
  return next
}

export function updatePreset(p: Preset): AppSettings {
  const cur = loadSettings()
  const normalized = normalizePreset(p)
  const next: AppSettings = ensureActive({
    ...cur,
    presets: cur.presets.map((x) => (x.id === normalized.id ? normalized : x)),
  })
  writeSettings(next)
  return next
}export function deletePreset(id: string): AppSettings {
  const cur = loadSettings()
  if (cur.presets.length <= 1) return cur   // 至少保留一条，避免空表
  const presets = cur.presets.filter((p) => p.id !== id)
  const activePresetId = cur.activePresetId === id ? presets[0]!.id : cur.activePresetId
  const next: AppSettings = ensureActive({ ...cur, presets, activePresetId })
  writeSettings(next)
  return next
}

export function setActivePreset(id: string): AppSettings {
  const cur = loadSettings()
  if (!cur.presets.find((p) => p.id === id)) return cur
  const next: AppSettings = ensureActive({ ...cur, activePresetId: id })
  writeSettings(next)
  return next
}

// ---------- Skills ----------
// 上传入口：name 为空时调用方已按文件名推好默认名；同名视为“覆盖更新”
// （保留原 id/createdAt，只换 content），不同名追加。
export function addSkill(input: { name: string; content: string; sourceName?: string }): AppSettings {
  const cur = loadSettings()
  const name = normalizeSkillName(input.name)
  const content = typeof input.content === 'string' ? input.content : ''
  if (!name || !content.trim() || content.length > SKILL_CONTENT_MAX) return cur
  const skills = normalizeSkillList(cur.skills)
  const sourceName = typeof input.sourceName === 'string' ? input.sourceName : ''
  const at = skills.findIndex((s) => s.name === name)
  if (at >= 0) {
    const prev = skills[at]!
    skills[at] = { ...prev, content, sourceName, charCount: content.length }
  } else {
    skills.push({ id: newSkillId(), name, content, sourceName, charCount: content.length, createdAt: Date.now() })
  }
  const next: AppSettings = ensureActive({ ...cur, skills })
  writeSettings(next)
  return next
}

export function deleteSkill(id: string): AppSettings {
  const cur = loadSettings()
  const skills = normalizeSkillList(cur.skills)
  if (!skills.some((s) => s.id === id)) return cur
  const next: AppSettings = ensureActive({ ...cur, skills: skills.filter((s) => s.id !== id) })
  writeSettings(next)
  return next
}

function normalizeModels(input: unknown): string[] {
  const list = Array.isArray(input) ? input : []
  const cleaned = list
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim())
    .filter((x) => x.length > 0 && x.length <= 120)
  const deduped = Array.from(new Set(cleaned))
  return deduped.length > 0 ? deduped : [...DEFAULT_MODELS]
}

export function addModel(name: string): AppSettings {
  const cur = loadSettings()
  const trimmed = (name ?? '').trim()
  if (!trimmed || trimmed.length > 120) return cur
  const models = normalizeModels(cur.models)
  if (!models.includes(trimmed)) models.push(trimmed)
  else return cur // 已存在：直接返回，避免无意义写盘触发 UI 抖动
  const next: AppSettings = ensureActive({ ...cur, models })
  writeSettings(next)
  return next
}

export function deleteModel(name: string): AppSettings {
  const cur = loadSettings()
  const trimmed = (name ?? '').trim()
  if (!trimmed) return cur
  const before = normalizeModels(cur.models)
  const models = before.filter((m) => m !== trimmed)
  // 至少保留一个模型；要删的不存在时直接返回，避免无意义写盘
  if (models.length === 0 || models.length === before.length) return cur
  const next: AppSettings = ensureActive({ ...cur, models })
  // 若当前激活预设用的模型被删了，不动预设（预设允许自定义模型名），只收窄全局列表；
  // 侧边栏会以虚线 custom chip 展示该预设模型，保证大字与 chips 对得上。
  writeSettings(next)
  return next
}

function writeSettings(s: AppSettings): void {
  if (!existsSync(app.getPath('userData'))) mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(settingsPath(), JSON.stringify(s, null, 2), 'utf-8')
}
