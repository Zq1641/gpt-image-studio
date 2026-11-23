import { PromptEditor } from './PromptEditor'
import { SkillPicker } from './SkillPicker'
import { PreviewBox } from './PreviewBox'
import { HistoryPanel } from './HistoryPanel'
import { useComposer } from '../state/useComposer'

export function MainPane() {
  const { state } = useComposer()
  const skillCount = state.settings.skills?.length ?? 0
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
          <div className="eyebrow">
            <span>Skills</span>
            <span style={{ marginLeft: 'auto', color: 'var(--text-3)' }}>{skillCount}</span>
          </div>
          <SkillPicker />
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