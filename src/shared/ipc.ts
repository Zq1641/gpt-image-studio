import type {
  AppSettings,
  CacheStats,
  GenerateRequest,
  GenerateResult,
  HistoryEntry,
  Preset,
} from './types'

export const CH = {
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  modelsAdd: 'models:add',
  modelsDelete: 'models:delete',
  // 预设 CRUD + 激活切换
  presetsAdd: 'presets:add',
  presetsUpdate: 'presets:update',
  presetsDelete: 'presets:delete',
  presetsSetActive: 'presets:setActive',
  // Skills：上传（同名覆盖） + 删除
  skillsAdd: 'skills:add',
  skillsDelete: 'skills:delete',
  // 历史：清空 + 下载原图（单张或全部）
  historyClear: 'history:clear',
  historyDownload: 'history:download',
  historyDownloadAll: 'history:download-all',
  // 缓存：统计 + 按项清理
  cacheStats: 'cache:stats',
  cacheClearImages: 'cache:clear-images',
  cacheClearRefs: 'cache:clear-refs',
  cacheClearAll: 'cache:clear-all',
  generateRun: 'generate:run',
  generateCancel: 'generate:cancel',
  historyList: 'history:list',
  historyDelete: 'history:delete',
} as const

export interface Api {
  getSettings(): Promise<AppSettings>
  saveSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  addModel(name: string): Promise<AppSettings>
  deleteModel(name: string): Promise<AppSettings>
  addPreset(p: Omit<Preset, 'id'>): Promise<AppSettings>
  updatePreset(p: Preset): Promise<AppSettings>
  deletePreset(id: string): Promise<AppSettings>
  setActivePreset(id: string): Promise<AppSettings>
  addSkill(input: { name: string; content: string; sourceName?: string }): Promise<AppSettings>
  deleteSkill(id: string): Promise<AppSettings>
  clearHistory(): Promise<HistoryEntry[]>
  downloadHistoryFile(filename: string): Promise<void>
  downloadHistoryFiles(filenames: string[]): Promise<void>
  getCacheStats(): Promise<CacheStats>
  clearGeneratedImages(): Promise<CacheStats>
  clearRefCache(): Promise<CacheStats>
  clearAllCache(): Promise<{ entries: HistoryEntry[]; stats: CacheStats }>
  generate(req: GenerateRequest): Promise<GenerateResult>
  cancel(requestId: string): Promise<void>
  listHistory(): Promise<HistoryEntry[]>
  deleteHistory(id: string): Promise<HistoryEntry[]>
}
