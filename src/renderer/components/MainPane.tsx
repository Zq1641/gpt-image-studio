import { useState } from 'react'
import { PromptEditor } from './PromptEditor'
import { TemplatePills } from './TemplatePills'
import { SkillPicker } from './SkillPicker'
import { PreviewBox } from './PreviewBox'
import { HistoryPanel } from './HistoryPanel'
import { useComposer } from '../state/useComposer'

export function MainPane() {
  const { state } = useComposer()
  const skillCount = state.settings.skills?.length ?? 0
  const [tab, setTab] = useState<'presets' | 'skills'>(skillCount > 0 ? 'skills' : 'presets')

  return (
    <main className="main">
      <section className="main-row-top">
        <div className="editor-col">
          <div className="eyebrow">
            <span>Composition</span>
          </div>
          <PromptEditor />
        </div>
        <div className="templates-col">
          <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="tab-pill-group">
              <button
                type="button"
                className={`tab-pill ${tab === 'presets' ? 'is-active' : ''}`}
                onClick={() => setTab('presets')}
              >
                Presets <span className="num">5</span>
              </button>
              <button
                type="button"
                className={`tab-pill ${tab === 'skills' ? 'is-active' : ''}`}
                onClick={() => setTab('skills')}
              >
                Skills {skillCount > 0 && <span className="num">{skillCount}</span>}
              </button>
            </div>
          </div>
          {tab === 'presets' ? <TemplatePills /> : <SkillPicker />}
        </div>
      </section>

      <section className="main-row-bottom">
        <div className="print-col">
          <div className="eyebrow">
            <span>Output</span>
          </div>
          <PreviewBox />
        </div>
        <div className="archive-col">
          <HistoryPanel />
        </div>
      </section>
    </main>
  )
}
