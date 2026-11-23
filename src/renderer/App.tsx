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
    return () => {
      window.removeEventListener('dragover', stop)
      window.removeEventListener('drop', stop)
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
