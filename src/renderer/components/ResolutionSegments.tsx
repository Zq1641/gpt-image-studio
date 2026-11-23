import { useState } from 'react'
import type { Quality, Resolution } from '@shared/types'
import { getSupportedQualities } from '@shared/types'
import { useComposer } from '../state/useComposer'

const SIZE_BASE: Resolution[] = ['auto', '1K', '2K', '4K', '6K', '8K']

const QUALITY_LABEL: Record<Quality, string> = {
  auto: 'Auto',
  low: 'Low',
  medium: 'Med',
  high: 'High',
  xhigh: 'XHigh',
  max: 'Max',
}

function isWxH(r: string): boolean {
  return /^\d+x\d+$/.test(r)
}

export function ResolutionSegments() {
  const { state, setParam } = useComposer()
  const params = state.params
  const active = state.settings.presets.find((p) => p.id === state.settings.activePresetId)
  const qualities = getSupportedQualities(active?.model ?? '')

  const [customOpen, setCustomOpen] = useState(false)
  const [customInput, setCustomInput] = useState('')

  const handleCustomSubmit = () => {
    const v = customInput.trim()
    if (!isWxH(v)) {
      alert('格式不对，请输入类似 1024x1536 的自定义分辨率')
      return
    }
    setParam('resolution', v as Resolution)
    setCustomOpen(false)
  }

  const isCustomSize = isWxH(params.resolution)

  return (
    <div className="field format-field">
      <div className="format-group">
        <div className="format-label-row">
          <span className="field-label">尺寸 SIZE</span>
          {isCustomSize && <span className="custom-size-badge">{params.resolution}</span>}
        </div>
        <div className="segments seg-compact" role="tablist" aria-label="尺寸">
          {SIZE_BASE.map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={params.resolution === r}
              className={params.resolution === r ? 'is-active' : ''}
              onClick={() => { setCustomOpen(false); setParam('resolution', r) }}
            >
              {r === 'auto' ? 'Auto' : r}
            </button>
          ))}
          <button
            type="button"
            className={`btn-custom-toggle ${isCustomSize ? 'is-active' : ''}`}
            title="自定义尺寸 WxH"
            onClick={() => {
              setCustomInput(isCustomSize ? params.resolution : '1024x1536')
              setCustomOpen(!customOpen)
            }}
          >
            {isCustomSize ? '✎' : '+'}
          </button>
        </div>
        {customOpen && (
          <div className="custom-size-popover">
            <input
              type="text"
              placeholder="宽x高 例如 1024x1536"
              value={customInput}
              autoFocus
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCustomSubmit()
                if (e.key === 'Escape') setCustomOpen(false)
              }}
            />
            <button type="button" className="pill" onClick={handleCustomSubmit}>确定</button>
            <button type="button" className="pill" onClick={() => setCustomOpen(false)}>取消</button>
          </div>
        )}
      </div>

      <div className="format-group" style={{ marginTop: 8 }}>
        <div className="format-label-row">
          <span className="field-label">细节 QUALITY</span>
        </div>
        <div className="segments seg-compact" role="tablist" aria-label="细节">
          {qualities.map((q) => (
            <button
              key={q}
              type="button"
              role="tab"
              aria-selected={params.quality === q}
              className={params.quality === q ? 'is-active' : ''}
              onClick={() => setParam('quality', q)}
            >
              {QUALITY_LABEL[q]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
