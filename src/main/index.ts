import { app, BrowserWindow, ipcMain, protocol } from 'electron'
import { join } from 'node:path'
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { CH } from '../shared/ipc'
import {
  loadSettings, saveSettings, addModel, deleteModel,
  addPreset, updatePreset, deletePreset, setActivePreset,
  addSkill, deleteSkill,
} from './settings'
import { generate, cancel } from './api'
import {
  appendHistory, deleteHistory, listHistory, clearHistory, downloadHistoryFile, downloadHistoryFiles,
  getCacheStats, clearGeneratedImages, clearRefCache, clearAllCache,
  isSafeImageFilename,
} from './history'
import { registerImageProtocol } from './protocol'

// img:// scheme registration MUST run before app.whenReady().
protocol.registerSchemesAsPrivileged([
  { scheme: 'img', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
])

// 改名迁移：appId 从 com.pony.gptimage2 → com.pony.gptimagestudio，
// productName 从 "GPT Image 2" → "GPT Image" 后，userData 目录会变化，
// 旧的历史/设置/图片全在老目录里。首次启动时把老目录内容拷贝过来
// （只拷贝、不删除老目录、不覆盖新目录已有文件），老用户升级不断档。
//
// 老目录有两种可能（都要兼容）：
//   1. 打包版旧应用：`…/Application Support/GPT Image 2`（按旧 productName 推导）
//   2. 开发版跑出来的：`…/Application Support/gpt-image-2`（按旧 package.json name 推导）
// 候选按优先级排序，命中第一个含数据的即用，不逐个合并（防两个老目录各一份导致混拷）。
function migrateLegacyUserData(): void {
  try {
    const next = app.getPath('userData')
    const appData = app.getPath('appData')
    const candidates = [
      join(appData, 'GPT Image 2'),
      join(appData, 'gpt-image-2'),
    ].filter((p) => p !== next)
    const legacy = candidates.find((p) => {
      try {
        if (!existsSync(p) || !statSync(p).isDirectory()) return false
        // 含任一有效数据才算命中：空的 Electron 残留目录不算
        if (existsSync(join(p, 'settings.json'))) return true
        if (existsSync(join(p, 'history.json'))) return true
        try { return readdirSync(join(p, 'images')).length > 0 } catch { return false }
      } catch { return false }
    })
    if (!legacy) return
    if (!existsSync(next)) mkdirSync(next, { recursive: true })
    // 只有新目录完全没数据时才迁：避免把旧快照覆盖掉新用户已用的配置。
    // 新目录已有 settings.json/history.json/images 任一 → 视为已迁移或新用户，跳过。
    const hasData =
      existsSync(join(next, 'settings.json')) ||
      existsSync(join(next, 'history.json')) ||
      (() => {
        try { return readdirSync(join(next, 'images')).length > 0 } catch { return false }
      })()
    if (hasData) return
    let copied = 0
    let skipped = 0
    for (const name of ['settings.json', 'history.json']) {
      const src = join(legacy, name)
      const dest = join(next, name)
      try {
        if (!existsSync(src) || !statSync(src).isFile() || existsSync(dest)) { skipped += 1; continue }
        copyFileSync(src, dest)
        copied += 1
      } catch (e) {
        console.error(`[migrate] copy failed: ${name}`, e)
      }
    }
    // images 目录逐文件拷贝（只拷缺失、不覆盖）：cpSync 整目录在 dest 已存在时
    // 行为不一致，逐文件最稳，也能逐个统计。
    try {
      const srcDir = join(legacy, 'images')
      if (existsSync(srcDir) && statSync(srcDir).isDirectory()) {
        const destDir = join(next, 'images')
        if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })
        for (const f of readdirSync(srcDir)) {
          try {
            const src = join(srcDir, f)
            const dest = join(destDir, f)
            if (!statSync(src).isFile() || existsSync(dest)) { skipped += 1; continue }
            copyFileSync(src, dest)
            copied += 1
          } catch { skipped += 1 }
        }
      }
    } catch (e) {
      console.error('[migrate] copy failed: images', e)
    }
    console.log(`[migrate] legacy userData copied: ${legacy} -> ${next} (copied=${copied} skipped=${skipped}, legacy kept)`)
  } catch (e) {
    // 迁移失败不阻塞启动：用户最多是旧历史没带过来，老目录原样保留可手动拷。
    console.error('[migrate] legacy userData migration failed', e)
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 980,
    minHeight: 660,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    transparent: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.once('ready-to-show', () => win.show())
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.handle(CH.settingsGet, async () => loadSettings())
ipcMain.handle(CH.settingsSet, async (_e, patch) => saveSettings(patch))
ipcMain.handle(CH.modelsAdd, async (_e, name) => addModel(name))
ipcMain.handle(CH.modelsDelete, async (_e, name) => deleteModel(name))
ipcMain.handle(CH.presetsAdd, async (_e, p) => addPreset(p))
ipcMain.handle(CH.presetsUpdate, async (_e, p) => updatePreset(p))
ipcMain.handle(CH.presetsDelete, async (_e, id) => deletePreset(id))
ipcMain.handle(CH.presetsSetActive, async (_e, id) => setActivePreset(id))
ipcMain.handle(CH.skillsAdd, async (_e, input) => addSkill(input))
ipcMain.handle(CH.skillsDelete, async (_e, id) => deleteSkill(id))
ipcMain.handle(CH.generateRun, async (_e, req) => {
  const r = await generate(req)
  if (r.ok) appendHistory(r.entry)
  return r
})
ipcMain.handle(CH.generateCancel, async (_e, { requestId }) => { cancel(requestId) })
ipcMain.handle(CH.historyList, async () => listHistory())
ipcMain.handle(CH.historyDelete, async (_e, { id }) => deleteHistory(id))
ipcMain.handle(CH.historyClear, async () => clearHistory())
ipcMain.handle(CH.cacheStats, async () => getCacheStats())
ipcMain.handle(CH.cacheClearImages, async () => clearGeneratedImages())
ipcMain.handle(CH.cacheClearRefs, async () => clearRefCache())
ipcMain.handle(CH.cacheClearAll, async () => {
  const stats = clearAllCache()
  return { entries: [] as never[], stats }
})
ipcMain.handle(CH.historyDownload, async (_e, filename) => {
  // IPC 入口先挡一层：文件名白名单，非法直接丢弃，不进 downloadHistoryFile。
  if (!isSafeImageFilename(filename)) return
  try { await downloadHistoryFile(filename) } catch (e) { console.error('download failed', e) }
})
ipcMain.handle(CH.historyDownloadAll, async (_e, filenames) => {
  // 只放行通过白名单的文件名；非数组或含非法项直接过滤/拒绝。
  if (!Array.isArray(filenames)) return
  const safe = filenames.filter(isSafeImageFilename)
  if (safe.length === 0) return
  try { await downloadHistoryFiles(safe) } catch (e) { console.error('download-all failed', e) }
})

app.whenReady().then(() => {
  migrateLegacyUserData()
  registerImageProtocol()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
