import {
  createContext, useContext, useEffect, useMemo, useReducer, useRef,
} from 'react'
import type { ReactNode } from 'react'
import type {
  AspectRatio, Count, GeneratedImage, GenerateParams, GenerateRequest,
  HistoryEntry, Preset, Quality, RefImage, Resolution,
} from '@shared/types'
import { DEFAULT_SETTINGS, getSupportedQualities, normalizeQuality, normalizeResolution, type AppSettings } from '@shared/types'
import { TEMPLATES, type TemplateId } from '../data/templates'

type Status = 'idle' | 'loading' | 'error'

interface ComposerState {
  prompt: string
  params: GenerateParams
  refImages: RefImage[]
  status: Status
  activeRequestId?: string
  error?: { code: string; message: string; body?: string }
  results: GeneratedImage[]
  history: HistoryEntry[]
  settings: AppSettings
  // 当前预览条目（生成的新结果，或历史回填）。previewEntry.images 决定 PreviewBox 渲染哪些图
  previewEntry?: HistoryEntry
}

type Action =
  | { type: 'set-prompt'; value: string }
  | { type: 'set-param'; key: keyof GenerateParams; value: GenerateParams[keyof GenerateParams] }
  | { type: 'apply-template'; id: TemplateId }
  | { type: 'set-refs'; refs: RefImage[] }
  | { type: 'set-status'; status: Status; error?: ComposerState['error']; requestId?: string }
  | { type: 'set-results'; results: GeneratedImage[]; entry?: HistoryEntry }
  | { type: 'set-history'; history: HistoryEntry[] }
  | { type: 'set-settings'; settings: AppSettings }
  | { type: 'set-preview'; entry: HistoryEntry | undefined }

const INITIAL_PARAMS: GenerateParams = { aspect: '1:1', resolution: 'auto', quality: 'auto', count: 1 }

const initialState: ComposerState = {
  prompt: '',
  params: INITIAL_PARAMS,
  refImages: [],
  status: 'idle',
  error: undefined,
  results: [],
  history: [],
  settings: DEFAULT_SETTINGS,
}

function reducer(state: ComposerState, action: Action): ComposerState {
  switch (action.type) {
    case 'set-prompt': return { ...state, prompt: action.value }
    case 'set-param': return { ...state, params: { ...state.params, [action.key]: action.value } }
    case 'apply-template': {
      const t = TEMPLATES.find((x) => x.id === action.id)
      return t ? { ...state, prompt: t.text } : state
    }
    case 'set-refs': return { ...state, refImages: action.refs }
    case 'set-status':
      return {
        ...state,
        status: action.status,
        error: action.error,
        activeRequestId: action.status === 'loading' ? action.requestId : undefined,
      }
    case 'set-results':
      return { ...state, results: action.results, previewEntry: action.entry, activeRequestId: undefined }
    case 'set-history': return { ...state, history: action.history }
    case 'set-settings': return { ...state, settings: action.settings }
    case 'set-preview': return { ...state, previewEntry: action.entry, results: action.entry?.images ?? [] }
    default: return state
  }
}

interface ComposerApi {
  state: ComposerState
  setPrompt(v: string): void
  setParam(key: keyof GenerateParams, value: AspectRatio | Resolution | Quality | Count): void
  applyTemplate(id: TemplateId): void
  insertSkill(name: string): void
  setRefs(refs: RefImage[]): void
  runGenerate(promptResolved: string): Promise<void>
  cancelGenerate(): Promise<void>
  refreshHistory(): Promise<void>
  reloadSettings(): Promise<void>
  setActivePreset(id: string): Promise<void>
  setPresetModel(id: string, model: string): Promise<void>
  addModel(name: string): Promise<void>
  deleteModel(name: string): Promise<void>
  addSkill(input: { name: string; content: string; sourceName?: string }): Promise<void>
  deleteSkill(id: string): Promise<void>
  saveSettings(patch: Partial<AppSettings>): Promise<void>
  deleteHistoryEntry(id: string): Promise<void>
  refillFromHistory(h: HistoryEntry): void
}

const ComposerContext = createContext<ComposerApi | null>(null)

export function ComposerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  // 最新 state 的 ref：runGenerate 是异步的，await 之后闭包里的 state 会过期，
  // 用 ref 拿“发起时的 prompt/params/refImages”快照，避免竞态。
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    if (!window.api) return
    void window.api.getSettings().then((s) => dispatch({ type: 'set-settings', settings: s }))
    void window.api.listHistory().then((h) => dispatch({ type: 'set-history', history: h }))
  }, [])

  const api: ComposerApi = useMemo(() => ({
    state,
    setPrompt(v) { dispatch({ type: 'set-prompt', value: v }) },
    setParam(key, value) { dispatch({ type: 'set-param', key: key as keyof GenerateParams, value: value as never }) },
    applyTemplate(id) { dispatch({ type: 'apply-template', id }) },
    // 点击右上角 skill → 在 prompt 末尾追加一个 skill token（`⟦skill:NAME⟧ `）。
    // 重复点击同一 skill 不重复追加；PromptEditor 会把它 render 成红色胶囊。
    // 用空格分隔（不用换行）：编辑器的文本模型里 <br> 不占字符，
    // 换行分隔的 token 在回解析时容易粘连——空格能完整 surviving。
    insertSkill(name) {
      const token = `⟦skill:${name}⟧`
      const cur = stateRef.current.prompt
      if (cur.includes(token)) return
      const sep = cur.length === 0 || /[\s]$/.test(cur) ? '' : ' '
      dispatch({ type: 'set-prompt', value: `${cur}${sep}${token} ` })
    },
    setRefs(refs) { dispatch({ type: 'set-refs', refs }) },
    async runGenerate(promptResolved: string) {
      // P0 并发互斥（前端同步锁）：dispatch 是同步的，所以这个判断+占位是原子的——
      // 连点、快捷键重入、React 18 StrictMode 双调用都只会放行第一个。
      // main 侧还有第二道 busy 锁（防多窗口/未来多入口），此处是主防线。
      if (stateRef.current.status === 'loading' || stateRef.current.activeRequestId) return
      const snap = stateRef.current
      const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      const req: GenerateRequest = {
        requestId,
        promptRaw: snap.prompt,
        promptResolved,
        params: snap.params,
        images: snap.refImages.map((r) => r.dataUrl),
        // 参考图快照随请求发给 main，落盘进历史，回填时可直接恢复
        refImages: snap.refImages.map((r, i) => ({ ...r, index: i + 1 })),
      }
      console.log('[input] promptRaw len=', snap.prompt.length, snap.prompt.slice(0, 200))
      console.log('[parsedPrompt]', promptResolved.slice(0, 300))
      console.log('[ipcPayload] requestId=', requestId, 'images=', req.images.length, 'refImages=', req.refImages?.length ?? 0)
      console.log('[localFile] refs=', snap.refImages.map((r) => ({ name: r.name, bytes: r.bytes, hasData: !!r.dataUrl })).slice(0, 4));
      console.log('[job] job_id=', requestId, 'enqueue images=', req.images.length);
      console.assert(snap.refImages.every((r) => !!r.dataUrl), '[localFile] assert dataUrl');
      if (snap.refImages.length > 0 && snap.refImages.some((r) => !r.dataUrl)) {
        console.log('[ipcPayload] missing dataUrl/path, intercept');
        dispatch({ type: 'set-status', status: 'error', error: { code: 'payload', message: '参考图缺失，已拦截（红点）' } })
        return
      }
      if (req.images.some((s) => s.includes('/Users/'))) console.warn('[ipcPayload] contains /Users absolute path, should be file:// or img://')
      dispatch({ type: 'set-status', status: 'loading', requestId })
      let r: Awaited<ReturnType<typeof window.api.generate>>
      try {
        r = await window.api.generate(req)
      } catch (e) {
        dispatch({
          type: 'set-status',
          status: 'error',
          error: { code: 'network', message: e instanceof Error ? e.message : '生成请求失败' },
        })
        return
      }
      if (r.ok) {
        // 过期回包保护：等待期间用户可能点了取消（或又发起了新请求），
        // 此时 activeRequestId 已变化，这个回包直接丢弃，不覆盖当前 UI。
        if (stateRef.current.activeRequestId !== requestId) return
        dispatch({ type: 'set-results', results: r.entry.images, entry: r.entry })
        const h = await window.api.listHistory()
        dispatch({ type: 'set-history', history: h })
        dispatch({ type: 'set-status', status: 'idle' })
      } else if (r.code === 'busy') {
        // main 侧第二道锁（多窗口等极端路径），前端锁没拦住时才到这里。
        // 注意：此前已 dispatch loading 占位，必须在此收尾，否则界面转圈卡死、
        // 且 activeRequestId 一直占着导致后续所有生成都被前端锁拦掉。
        if (stateRef.current.activeRequestId !== requestId) return
        dispatch({ type: 'set-status', status: 'error', error: { code: r.code, message: r.message, body: r.body } })
        return
      } else {
        if (stateRef.current.activeRequestId !== requestId) return
        dispatch({ type: 'set-status', status: 'error', error: { code: r.code, message: r.message, body: r.body } })
      }
    },
    async cancelGenerate() {
      const requestId = stateRef.current.activeRequestId
      if (!requestId) return
      // 先让 main 侧 abort，再把 UI 切到 canceled 状态。
      // generate() 的 promise 随后也会 resolve（canceled），但此时已不是 loading，
      // 用 activeRequestId 对账：只处理“仍是同一请求”的回包，过期回包直接丢弃。
      try {
        await window.api.cancel(requestId)
      } catch { /* ignore */ }
      if (stateRef.current.activeRequestId === requestId) {
        dispatch({ type: 'set-status', status: 'error', error: { code: 'canceled', message: '已取消生成' } })
      }
    },
    refillFromHistory(h) {
      dispatch({ type: 'set-prompt', value: h.promptRaw })
      dispatch({ type: 'set-param', key: 'aspect', value: h.params.aspect })
      dispatch({ type: 'set-param', key: 'resolution', value: normalizeResolution(h.params.resolution) })
      // Old history rows (pre-quality field) lack `quality`; fall back to medium.
      dispatch({ type: 'set-param', key: 'quality', value: normalizeQuality(h.params.quality) })
      dispatch({ type: 'set-param', key: 'count', value: h.params.count })
      // 回填参考图快照：老条目没有 refImages 字段时恢复为空，不崩。
      const refs: RefImage[] = Array.isArray(h.refImages)
        ? h.refImages.map((r, i) => ({ ...r, index: i + 1 }))
        : []
      dispatch({ type: 'set-refs', refs })
      dispatch({ type: 'set-preview', entry: h })
      dispatch({ type: 'set-status', status: 'idle', error: undefined })
    },
    async refreshHistory() {
      const h = await window.api.listHistory()
      dispatch({ type: 'set-history', history: h })
    },
    async deleteHistoryEntry(id) {
      const h = await window.api.deleteHistory(id)
      dispatch({ type: 'set-history', history: h })
      // 若删掉的正是当前预览条目，清空预览，避免 PreviewBox 挂着已删除的图片
      if (stateRef.current.previewEntry?.id === id) {
        dispatch({ type: 'set-preview', entry: undefined })
      }
    },
    async reloadSettings() {
      const s = await window.api.getSettings()
      dispatch({ type: 'set-settings', settings: s })
    },
    async setActivePreset(id) {
      const s = await window.api.setActivePreset(id)
      dispatch({ type: 'set-settings', settings: s })
    },
    async addSkill(input) {
      const s = await window.api.addSkill(input)
      dispatch({ type: 'set-settings', settings: s })
    },
    async deleteSkill(id) {
      const s = await window.api.deleteSkill(id)
      dispatch({ type: 'set-settings', settings: s })
    },
    async setPresetModel(id, model) {
      const target = stateRef.current.settings.presets.find((p) => p.id === id)
      if (!target) return
      const trimmed = model.trim()
      if (!trimmed || trimmed === target.model) return
      const s = await window.api.updatePreset({ ...target, model: trimmed })
      dispatch({ type: 'set-settings', settings: s })
      // 切到老四模型时 xhigh/max 自动钳位到 medium，避免发包被拒、UI 残留高档选中
      const allowed = getSupportedQualities(trimmed)
      const curQ = stateRef.current.params.quality
      if (!(allowed as string[]).includes(curQ) ) dispatch({ type: 'set-param', key: 'quality', value: 'medium' })
    },
    async addModel(name) {
      const trimmed = name.trim()
      if (!trimmed) return
      const s = await window.api.addModel(name)
      dispatch({ type: 'set-settings', settings: s })
    },
    async deleteModel(name) {
      const trimmed = name.trim()
      if (!trimmed) return
      // 乐观更新：先本地移除 chip 给即时反馈，失败再 reload 回滚。
      // 解决“点了 × 界面没变化”的体感问题（尤其 IPC 慢/弹窗被拦时）。
      const prev = stateRef.current.settings
      const models = Array.isArray(prev.models) ? prev.models : []
      if (models.includes(trimmed) && models.length > 1) {
        dispatch({ type: 'set-settings', settings: { ...prev, models: models.filter((m) => m !== trimmed) } })
      }
      try {
        const s = await window.api.deleteModel(name)
        dispatch({ type: 'set-settings', settings: s })
      } catch {
        const s = await window.api.getSettings()
        dispatch({ type: 'set-settings', settings: s })
      }
    },
    async saveSettings(patch) {
      const s = await window.api.saveSettings(patch)
      dispatch({ type: 'set-settings', settings: s })
    },
  }), [state])

  return <ComposerContext.Provider value={api}>{children}</ComposerContext.Provider>
}

export function useComposer(): ComposerApi {
  const v = useContext(ComposerContext)
  if (!v) throw new Error('useComposer must be used inside ComposerProvider')
  return v
}

export function useActivePreset(): Preset {
  const { state } = useComposer()
  return state.settings.presets.find((p) => p.id === state.settings.activePresetId) ?? state.settings.presets[0]!
}
