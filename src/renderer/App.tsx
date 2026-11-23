import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { MainPane } from './components/MainPane'
import { SettingsModal } from './components/SettingsModal'

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    const stop = (e: DragEvent) => { e.preventDefault() }
    window.addEventListener('dragover', stop)
    window.addEventListener('drop', stop)
    const onOpen = () => setSettingsOpen(true)
    window.addEventListener('open-settings', onOpen)

    // 窗口等比例动态响应缩放：基准视口 1180×820，
    // 窗口缩放时平滑联动全界面布局尺寸与字体大小，杜绝断层与滑动溢出。
    const updateScale = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      const scaleW = w / 1180
      const scaleH = h / 820
      const combined = scaleH * 0.55 + scaleW * 0.45
      const scale = Math.max(0.82, Math.min(1.50, combined))
      document.documentElement.style.setProperty('--ui-scale', scale.toFixed(3))
    }
    updateScale()
    window.addEventListener('resize', updateScale)

    return () => {
      window.removeEventListener('dragover', stop)
      window.removeEventListener('drop', stop)
      window.removeEventListener('open-settings', onOpen)
      window.removeEventListener('resize', updateScale)
    }
  }, [])

  return (
    <>
      <header className="drag-strip">
        <div className="brand">
          <span>gpt-image</span>
          <span className="mark">studio</span>
        </div>
        <button type="button" className="icon-btn" onClick={() => setSettingsOpen(true)}>
          Settings
        </button>
      </header>
      <div className="workbench">
        <Sidebar />
        <MainPane />
      </div>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  )
}
