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

  // WxH 自定义：不在基础档里时末尾透出一块 custom chip，避免选中态丢失
  const sizes: Resolution[] = SIZE_BASE.includes(params.resolution)
    ? SIZE_BASE
    : [...SIZE_BASE, params.resolution]

  const pickWxH = () => {
    const cur = isWxH(params.resolution) ? params.resolution : '1024x1536'
    const input = window.prompt('自定义尺寸 WxH，例如 1024x1536', cur)
    if (!input) return
    const v = input.trim()
    if (!isWxH(v)) {
      window.alert('格式不对，用 WxH，例如 1024x1536')
      return
    }
    setParam('resolution', v as Resolution)
  }

  return (
    <div className="field seg-field">
      <span className="field-label">分辨率</span>
      <div className="seg-stack">
        <div className="segments seg-grid seg-grid-size" role="tablist" aria-label="尺寸">
          {sizes.map((r) => {
            const label = r === 'auto' ? 'Auto' : isWxH(r) ? r : r
            const custom = isWxH(r)
            return (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={params.resolution === r}
                className={params.resolution === r ? 'is-active' : ''}
                title={custom ? `${r}（自定义尺寸）` : r}
                onClick={() => setParam('resolution', r)}
              >
                {label}
              </button>
            )
          })}
          <button
            type="button"
            title="自定义 WxH 尺寸"
            onClick={pickWxH}
          >
            +
          </button>
        </div>

        <div className="segments seg-grid seg-grid-quality" role="tablist" aria-label="细节">
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
