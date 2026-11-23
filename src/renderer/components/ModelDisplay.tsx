import { useState } from 'react'
import { useComposer } from '../state/useComposer'

// 模型选择器：chips 直选 + 末尾同样式 "+" 添加（无下拉框）。
// 选择写回当前激活预设的 model（预设维度存储，保证多预设多模型）；
// 增删维护全局模型列表 settings.models。
export function ModelDisplay() {
  const { state, setPresetModel, addModel, deleteModel } = useComposer()
  const { settings } = state
  const active = settings.presets.find((p) => p.id === settings.activePresetId) ?? settings.presets[0]!
  const models = Array.isArray(settings.models) && settings.models.length > 0
    ? settings.models
    : [active.model]
  // 预设允许自定义模型名：若当前预设的 model 不在列表里，末尾补一个
  // 虚线 custom chip 展示（不可删），避免大字与 chips 对不上。
  const inList = models.includes(active.model)
  const displayModels = inList ? models : [...models, active.model]

  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  // 行内二次确认：点 × 先进入待确认态（不依赖原生 confirm，避免弹窗被吞导致“点了没反应”）
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const commitAdd = async () => {
    const name = draft.trim()
    if (!name || busy) return
    setBusy(true)
    setError(null)
    try {
      await addModel(name)
      await setPresetModel(active.id, name)
      setAdding(false)
      setDraft('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '添加模型失败')
    } finally {
      setBusy(false)
    }
  }

  const requestDelete = (name: string) => {
    if (busy) return
    setError(null)
    setAdding(false)
    // 同一个 chip 的 × 点第二次 = 取消待确认态
    setPendingDelete((cur) => (cur === name ? null : name))
  }

  const confirmDelete = async (name: string) => {
    if (busy) return
    if (models.length <= 1) {
      setError('至少需要保留一个模型')
      setPendingDelete(null)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await deleteModel(name)
      setPendingDelete(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除模型失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="model-block">
      <div className="model-display">
        <span className="model-name">{active.model}</span>
        <span className="model-sub">model · {active.name}</span>
      </div>

      <div className="model-chips">
        {displayModels.map((m) => {
          const isCustom = !models.includes(m)
          return (
            <span
              key={m}
              className={`model-chip ${m === active.model ? 'is-active' : ''}${isCustom ? ' is-custom' : ''}${pendingDelete === m ? ' is-confirm' : ''}`}
            >
              <button
                type="button"
                className="model-chip-name"
                disabled={busy}
                onClick={() => void setPresetModel(active.id, m)}
                title={isCustom ? `${m}（当前预设的自定义模型，不在列表中）` : `切换到 ${m}`}
              >{m}</button>
              {!isCustom && models.length > 1 && (
                <button
                  type="button"
                  className="model-chip-x"
                  disabled={busy}
                  onClick={() => requestDelete(m)}
                  aria-label={pendingDelete === m ? `取消删除 ${m}` : `移除模型 ${m}`}
                  title={pendingDelete === m ? '再点一次取消' : `移除 ${m}`}
                >×</button>
              )}
            </span>
          )
        })}
        <button
          type="button"
          className={`model-chip is-add${adding ? ' is-active' : ''}`}
          disabled={busy}
          onClick={() => { setPendingDelete(null); setError(null); setAdding((v) => !v) }}
          aria-label="手动添加模型"
          title="手动添加模型"
        >+</button>
      </div>

      {pendingDelete && (
        <div className="model-confirm" role="alert">
          <span className="model-confirm-text">
            移除 <span className="name">「{pendingDelete}」</span>？
          </span>
          <span className="model-confirm-actions">
            <button type="button" className="pill danger" disabled={busy} onClick={() => void confirmDelete(pendingDelete)}>
              {busy ? '删除中…' : '确认删除'}
            </button>
            <button type="button" className="pill" disabled={busy} onClick={() => setPendingDelete(null)}>
              取消
            </button>
          </span>
        </div>
      )}

      {adding && (
        <div className="model-add">
          <input
            type="text"
            value={draft}
            autoFocus
            disabled={busy}
            placeholder="例如：gpt-image-2-turbo"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void commitAdd()
              else if (e.key === 'Escape') { setAdding(false); setDraft('') }
            }}
          />
          <div className="model-add-actions">
            <button type="button" className="pill" disabled={busy} onClick={() => { setAdding(false); setDraft('') }}>取消</button>
            <button type="button" className="pill" disabled={busy || !draft.trim()} onClick={() => void commitAdd()}>添加</button>
          </div>
        </div>
      )}

      {error && <div className="model-error">{error}</div>}
    </div>
  )
}
