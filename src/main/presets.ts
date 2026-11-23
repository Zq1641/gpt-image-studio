import { randomUUID } from 'node:crypto'
import { DEFAULT_MODELS, DEFAULT_SETTINGS, type AppSettings, type Preset } from '../shared/types'
import { normalizeSkillList } from '../shared/skills'

export type { Preset }
export { DEFAULT_MODELS } from '../shared/types'

// 与 settings.normalizeModels 同规则的本地清洗，避免 presets↔settings 循环 import。
// 两处规则必须保持一致：trim → 去空/超长 → 去重 → 空则回默认。
function normalizeModelList(input: unknown): string[] {
  const list = Array.isArray(input) ? input : []
  const cleaned = (list as unknown[])
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim())
    .filter((x) => x.length > 0 && x.length <= 120)
  const deduped = Array.from(new Set(cleaned))
  return deduped.length > 0 ? deduped : [...DEFAULT_MODELS]
}

function ensureActive(s: AppSettings): AppSettings {
  // 每次都保证 models / skills 字段存在（兼容旧版 settings.json 缺字段的情况），
  // 避免下游 deleteModel 写回的结果被一次“补默认”覆盖掉。
  const models = normalizeModelList((s as Partial<AppSettings>).models)
  const skills = normalizeSkillList((s as Partial<AppSettings>).skills)
  // 兼容旧版 settings.json：保留字段已废弃时回到默认；预设列表为空时塞一条默认
  if (!Array.isArray(s.presets) || s.presets.length === 0) {
    const first = DEFAULT_SETTINGS.presets[0]!
    return { ...DEFAULT_SETTINGS, ...s, models, skills, presets: [first], activePresetId: first.id }
  }
  if (!s.presets.find((p) => p.id === s.activePresetId)) {
    return { ...s, models, skills, activePresetId: s.presets[0]!.id }
  }
  if (!Array.isArray((s as Partial<AppSettings>).models) || !Array.isArray((s as Partial<AppSettings>).skills)) {
    return { ...s, models, skills }
  }
  return s
}

export function newPresetId(): string {
  return randomUUID()
}

export function normalizePreset(p: Preset): Preset {
  return {
    id: p.id,
    name: p.name?.trim() || '未命名预设',
    baseUrl: p.baseUrl?.trim().replace(/\/$/, '') || '',
    apiKey: p.apiKey ?? '',
    pricePerImage: Number.isFinite(p.pricePerImage) ? Math.max(0, p.pricePerImage) : 0,
    model: p.model?.trim() || 'gpt-image-2',
    imageFieldName: p.imageFieldName,
    sizeMode: p.sizeMode,
    sendAspectRatio: !!p.sendAspectRatio,
  }
}

export function activePreset(s: AppSettings): Preset {
  return s.presets.find((p) => p.id === s.activePresetId) ?? s.presets[0]!
}

export type { AppSettings }
export { DEFAULT_SETTINGS, ensureActive }
