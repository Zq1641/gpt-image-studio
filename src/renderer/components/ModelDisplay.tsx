import { useComposer } from '../state/useComposer'

// 模型选择器：主视觉保留 Fraunces 衬线体优雅大字展示，
// 搭配右侧微小的切换菜单，不在侧边栏常驻占用高度。
export function ModelDisplay() {
  const { state, setPresetModel } = useComposer()
  const { settings } = state
  const active = settings.presets.find((p) => p.id === settings.activePresetId) ?? settings.presets[0]!
  const models = Array.isArray(settings.models) && settings.models.length > 0
    ? settings.models
    : [active.model]
  const inList = models.includes(active.model)
  const displayModels = inList ? models : [...models, active.model]

  return (
    <div className="model-block">
      <div className="model-display">
        <div className="model-name-row">
          <span className="model-name" title={active.model}>{active.model}</span>
        </div>
        <div className="model-sub-row">
          <span className="model-sub">model · {active.name}</span>
          <div className="model-picker-badge" title="快速切换当前预设模型">
            <select
              className="model-native-select"
              value={active.model}
              onChange={(e) => {
                const val = e.target.value
                if (val === '__manage__') {
                  window.dispatchEvent(new CustomEvent('open-settings'))
                } else {
                  void setPresetModel(active.id, val)
                }
              }}
              aria-label="切换模型"
            >
              <optgroup label="切换模型">
                {displayModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </optgroup>
              <optgroup label="设置">
                <option value="__manage__">⚙ 管理全局模型...</option>
              </optgroup>
            </select>
            <span className="model-picker-trigger">切换 ▾</span>
          </div>
        </div>
      </div>
    </div>
  )
}
