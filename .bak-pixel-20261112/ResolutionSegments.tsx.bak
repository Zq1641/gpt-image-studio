import type { Quality, Resolution } from '@shared/types'
import { useComposer } from '../state/useComposer'

const SIZE_OPTIONS: Resolution[] = ['1K', '2K', '4K']
const QUALITY_OPTIONS: Quality[] = ['low', 'medium', 'high']

export function ResolutionSegments() {
  const { state, setParam } = useComposer()
  const params = state.params
  return (
    <div className="field">
      <span className="field-label">分辨率</span>
      <div className="dual-segments">
        <div className="segments" role="tablist" aria-label="尺寸">
          {SIZE_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={params.resolution === r}
              className={params.resolution === r ? 'is-active' : ''}
              onClick={() => setParam('resolution', r)}
            >
              {r}
            </button>
          ))}
        </div>
        <span className="dual-segments-divider" aria-hidden="true" />
        <div className="segments" role="tablist" aria-label="细节">
          {QUALITY_OPTIONS.map((q) => (
            <button
              key={q}
              type="button"
              role="tab"
              aria-selected={params.quality === q}
              className={params.quality === q ? 'is-active' : ''}
              onClick={() => setParam('quality', q)}
            >
              {q === 'low' ? 'Low' : q === 'medium' ? 'Med' : 'High'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
