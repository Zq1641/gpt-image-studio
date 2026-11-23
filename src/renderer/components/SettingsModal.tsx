import { useState } from 'react'
import { useComposer } from '../state/useComposer'
import type { ImageFieldName, Preset, SizeMode } from '@shared/types'

const EMPTY: Omit<Preset, 'id'> = {
  name: '',
  baseUrl: '',
  apiKey: '',
  pricePerImage: 0,
  model: 'gpt-image-2',
  imageFieldName: 'image',
  sizeMode: 'computed',
  sendAspectRatio: true,
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { state, reloadSettings } = useComposer()
  const presets = state.settings.presets
  const activeId = state.settings.activePresetId
  const models = state.settings.models ?? []
  const [editing, setEditing] = useState<Preset | Omit<Preset, 'id'> | null>(null)
  const [newModel, setNewModel] = useState('')
  const [modelError, setModelError] = useState<string | null>(null)
  const [modelPending, setModelPending] = useState<string | null>(null)

  const addModelEntry = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setModelError(null)
    try {
      await window.api.addModel(trimmed)
      setNewModel('')
      await reloadSettings()
    } catch (e) {
      setModelError(e instanceof Error ? e.message : '添加模型失败')
    }
  }

  const removeModelEntry = async (name: string) => {
    if (models.length <= 1) {
      setModelError('至少需要保留一个模型')
      setModelPending(null)
      return
    }
    setModelError(null)
    try {
      await window.api.deleteModel(name)
      setModelPending(null)
      await reloadSettings()
    } catch (e) {
      setModelError(e instanceof Error ? e.message : '删除模型失败')
    }
  }

  const saveEdit = async (p: Preset | Omit<Preset, 'id'>) => {
    if ('id' in p && p.id) {
      await window.api.updatePreset(p as Preset)
    } else {
      await window.api.addPreset(p)
    }
    await reloadSettings()
    setEditing(null)
  }

  const handleDelete = async (id: string, name: string) => {
    if (presets.length <= 1) {
      alert('至少需要保留一个预设')
      return
    }
    if (!confirm(`确认删除预设「${name}」？`)) return
    await window.api.deletePreset(id)
    await reloadSettings()
  }

  return (
    <div role="dialog" aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(20, 18, 15, 0.45)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{
          width: 580, maxHeight: '85vh', overflow: 'auto',
          background: 'var(--bg-card)', borderRadius: 'var(--r-md)',
          border: '1px solid var(--line-strong)',
          boxShadow: 'var(--shadow-pop)', padding: 28,
        }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{
            margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic',
            fontSize: 28, fontWeight: 500, color: 'var(--text-1)', letterSpacing: '-0.01em',
          }}>Presets & Settings</h2>
          <button type="button" className="pill" onClick={() => setEditing({ ...EMPTY })}>+ Add</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {presets.map((p) => (
            <PresetRow
              key={p.id}
              preset={p}
              isActive={p.id === activeId}
              canDelete={presets.length > 1}
              onEdit={() => setEditing(p)}
              onDelete={() => void handleDelete(p.id, p.name)}
            />
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" className="pill" onClick={onClose}>完成</button>
        </div>

        <div style={{ marginTop: 20, borderTop: '1px solid var(--rule)', paddingTop: 16 }}>
          <div className="field-label" style={{ marginBottom: 8 }}>全局模型列表 · Models</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {models.map((m) => (
              <span key={m} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                border: modelPending === m ? '1px solid var(--danger)' : '1px solid var(--line)',
                background: modelPending === m ? 'var(--danger-soft)' : 'transparent',
                borderRadius: 999,
                padding: '3px 4px 3px 10px',
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-1)',
              }}>
                {m}
                {models.length > 1 && (
                  <button type="button" className="pill" style={{ padding: '1px 8px' }}
                    title={modelPending === m ? '再点一次取消' : `移除 ${m}`}
                    onClick={() => {
                      if (modelPending === m) setModelPending(null)
                      else { setModelError(null); setModelPending(m) }
                    }}
                  >×</button>
                )}
              </span>
            ))}
          </div>
          {modelPending && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              border: '1px solid rgba(184, 36, 45, 0.4)', background: 'var(--danger-soft)',
              borderRadius: 'var(--r-sm)', padding: '6px 8px', marginBottom: 10,
              fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--danger)',
            }}>
              <span>移除「{modelPending}」？</span>
              <span style={{ display: 'flex', gap: 4 }}>
                <button type="button" className="pill danger" style={{ padding: '3px 8px' }}
                  onClick={() => void removeModelEntry(modelPending)}>确认删除</button>
                <button type="button" className="pill" style={{ padding: '3px 8px' }}
                  onClick={() => setModelPending(null)}>取消</button>
              </span>
            </div>
          )}
          {modelError && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: 'var(--danger)', marginBottom: 10,
            }}>{modelError}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newModel.trim()) void addModelEntry(newModel)
              }}
              placeholder="新增模型，例如 gpt-image-2-turbo"
              style={{ flex: 1 }} />
            <button type="button" className="pill"
              disabled={!newModel.trim()}
              onClick={() => void addModelEntry(newModel)}
            >+ 添加</button>
          </div>
        </div>

        {editing && (
          <PresetEditor
            draft={editing}
            onCancel={() => setEditing(null)}
            onSave={(p) => void saveEdit(p)}
          />
        )}
      </div>
    </div>
  )
}

function PresetRow({
  preset, isActive, canDelete, onEdit, onDelete,
}: { preset: Preset; isActive: boolean; canDelete: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={{
      border: '1px solid var(--line)', borderRadius: 10,
      padding: '10px 12px', background: 'var(--bg-input)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{preset.name}</span>
          {isActive && (
            <span style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 4,
              background: 'rgba(52,199,89,0.18)', color: '#1A7F37',
            }}>当前激活</span>
          )}
          {preset.pricePerImage > 0 && (
            <span style={{
              fontSize: 11, color: '#007AFF',
            }}>¥{preset.pricePerImage.toFixed(2)}/张</span>
          )}
        </div>
        <div style={{
          fontSize: 12, color: 'var(--text-3)', marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{preset.baseUrl || '未填写 Base URL'} · {preset.model}</div>
      </div>
      <button type="button" className="pill" onClick={onEdit}>编辑</button>
      <button type="button" className="pill"
        onClick={onDelete}
        disabled={!canDelete}
        style={{ color: canDelete ? '#D70015' : 'var(--text-3)' }}
        title={canDelete ? '删除此预设' : '至少保留一条预设'}
      >删除</button>
    </div>
  )
}

function PresetEditor({
  draft, onCancel, onSave,
}: {
  draft: Preset | Omit<Preset, 'id'>
  onCancel: () => void
  onSave: (p: Preset | Omit<Preset, 'id'>) => void
}) {
  const { state } = useComposer()
  const models = state.settings.models ?? []
  const [local, setLocal] = useState(draft)
  const [reveal, setReveal] = useState(false)

  const valid = local.name.trim().length > 0
    && /^https?:\/\//.test(local.baseUrl.trim())
    && local.apiKey.trim().length > 0

  return (
    <div onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 101,
      }}>
      <div style={{
        width: 480, maxHeight: '85vh', overflow: 'auto',
        background: 'var(--bg-card)', borderRadius: 14,
        boxShadow: 'var(--shadow-pop)', padding: 24,
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>
          {'id' in local && local.id ? '编辑预设' : '新增预设'}
        </h3>

        <div className="field" style={{ marginBottom: 12 }}>
          <label className="field-label">预设名称</label>
          <input type="text" value={local.name}
            onChange={(e) => setLocal({ ...local, name: e.target.value })}
            placeholder="例如：主力 ClaudeCode 站" />
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <label className="field-label">API Base URL（无尾斜杠、无 /v1）</label>
          <input type="text" value={local.baseUrl}
            onChange={(e) => setLocal({ ...local, baseUrl: e.target.value })}
            placeholder="https://api.example.com" />
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <label className="field-label">API Key</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type={reveal ? 'text' : 'password'} value={local.apiKey}
              onChange={(e) => setLocal({ ...local, apiKey: e.target.value })}
              style={{ flex: 1 }} />
            <button type="button" className="pill" onClick={() => setReveal((r) => !r)}>
              {reveal ? '隐藏' : '显示'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label">单次价格（元/张）</label>
            <input type="number" min={0} step={0.01} value={local.pricePerImage}
              onChange={(e) => setLocal({ ...local, pricePerImage: Number(e.target.value) || 0 })} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label">模型（跟随本预设 · 点选或手输）</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {models.map((m) => (
                <span key={m}
                  className={`model-chip ${local.model === m ? 'is-active' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setLocal({ ...local, model: m })}>
                  <span className="model-chip-name" style={{ cursor: 'pointer' }}>{m}</span>
                </span>
              ))}
            </div>
            <input type="text" value={local.model}
              onChange={(e) => setLocal({ ...local, model: e.target.value })}
              placeholder="也可直接输入自定义模型名"
              style={{ marginTop: 6 }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label">参考图字段名</label>
            <select value={local.imageFieldName}
              onChange={(e) => setLocal({ ...local, imageFieldName: e.target.value as ImageFieldName })}>
              <option value="image">image（单图）</option>
              <option value="images">images（数组）</option>
              <option value="image_url">image_url</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label">尺寸模式</label>
            <select value={local.sizeMode}
              onChange={(e) => setLocal({ ...local, sizeMode: e.target.value as SizeMode })}>
              <option value="computed">按比例计算</option>
              <option value="square">正方形</option>
              <option value="omit">不发送</option>
            </select>
          </div>
        </div>

        <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input id="epAspect" type="checkbox" checked={local.sendAspectRatio}
            onChange={(e) => setLocal({ ...local, sendAspectRatio: e.target.checked })} />
          <label className="field-label" htmlFor="epAspect" style={{ margin: 0 }}>
            同时发送 aspect_ratio 字段
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button type="button" className="pill" onClick={onCancel}>取消</button>
          <button type="button" className="generate-btn"
            onClick={() => onSave(local)}
            disabled={!valid}
            style={{ minWidth: 100, padding: '8px 16px', fontSize: 14, opacity: valid ? 1 : 0.4 }}
          >保存</button>
        </div>
      </div>
    </div>
  )
}
