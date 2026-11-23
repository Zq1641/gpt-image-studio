import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync, renameSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { app, dialog, BrowserWindow } from 'electron'
import type { CacheStats, HistoryEntry } from '../shared/types'

function userDataDir(): string {
  return app.getPath('userData')
}

function indexPath(): string {
  return join(userDataDir(), 'history.json')
}

function imagesDir(): string {
  const d = join(app.getPath('userData'), 'images')
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}

function readIndex(): HistoryEntry[] {
  const p = indexPath()
  if (!existsSync(p)) return []
  try {
    const raw = readFileSync(p, 'utf-8')
    const arr = JSON.parse(raw) as HistoryEntry[]
    if (!Array.isArray(arr)) return []
    return arr
  } catch {
    // history.json 损坏时：把坏文件改名为 history.corrupt-<时间戳>.json 留证，
    // 返回空列表让应用照常启动。只备份、不删除——用户数据一条都不丢，
    // 修好 JSON 后改回文件名即可恢复。
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      renameSync(p, join(userDataDir(), `history.corrupt-${stamp}.json`))
    } catch { /* 备份失败也无妨，下次启动再试 */ }
    return []
  }
}

function writeIndex(arr: HistoryEntry[]): void {
  const dir = userDataDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  // 原子写：先写 tmp 再 rename，避免进程崩溃时 history.json 写一半变坏。
  // tmp 与目标同目录，保证 rename 是同文件系统原子操作。
  const p = indexPath()
  const tmp = `${p}.tmp`
  writeFileSync(tmp, JSON.stringify(arr, null, 2), 'utf-8')
  renameSync(tmp, p)
}

export function listHistory(): HistoryEntry[] {
  return readIndex().sort((a, b) => b.createdAt - a.createdAt)
}

export function appendHistory(entry: HistoryEntry): HistoryEntry[] {
  const arr = readIndex()
  arr.push(entry)
  writeIndex(arr)
  return listHistory()
}

export function deleteHistory(id: string): HistoryEntry[] {
  const arr = readIndex()
  const target = arr.find((e) => e.id === id)
  const rest = arr.filter((e) => e.id !== id)
  writeIndex(rest)
  // 单条删除同时回收它独占的生成图文件：先收集剩余条目仍在引用的文件名，
  // 只删除不再被任何条目引用的文件，避免误删多条历史共享同名 plate 的极端情况。
  try {
    const stillUsed = new Set<string>()
    for (const e of rest) {
      for (const img of e.images ?? []) {
        if (img?.file) stillUsed.add(img.file)
      }
    }
    const dir = imagesDir()
    for (const img of target?.images ?? []) {
      const f = img?.file
      if (!f || stillUsed.has(f)) continue
      if (f.includes('..') || f.includes('/') || f.includes('\\')) continue
      const abs = join(dir, f)
      if (existsSync(abs)) {
        try { unlinkSync(abs) } catch { /* ignore */ }
      }
    }
  } catch { /* GC 失败不影响删除本身 */ }
  return listHistory()
}

export function clearHistory(): HistoryEntry[] {
  const dir = imagesDir()
  try {
    for (const f of readdirSync(dir)) {
      try { unlinkSync(join(dir, f)) } catch { /* ignore */ }
    }
  } catch { /* dir 可能不存在，没问题 */ }
  writeIndex([])
  return []
}

// ---------------- 缓存统计 + 按项清理 ----------------
// 体积口径：
//   - imageBytes：images/ 目录下全部生成图文件的实际字节
//   - historyBytes：history.json 文件体积（含内嵌的参考图快照）
//   - refBytes：历史条目里 refImages[].dataUrl 的 base64 估算字节（history.json 的子集，
//     单独列出来是为了让用户看清“参考图快照占了多少”，清理时可单独剥离）
//   - totalBytes = imageBytes + historyBytes（用户磁盘上真实占用的合计数）

function approxDataUrlBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',')
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl
  return Math.floor(b64.length * 0.75)
}

export function getCacheStats(): CacheStats {
  const dir = imagesDir()
  let imageCount = 0
  let imageBytes = 0
  try {
    for (const f of readdirSync(dir)) {
      try {
        const st = statSync(join(dir, f))
        if (st.isFile()) {
          imageCount += 1
          imageBytes += st.size
        }
      } catch { /* ignore */ }
    }
  } catch { /* dir 可能不存在 */ }

  let historyBytes = 0
  try {
    const st = statSync(indexPath())
    if (st.isFile()) historyBytes = st.size
  } catch { /* ignore */ }

  const entries = readIndex()
  let refCount = 0
  let refBytes = 0
  for (const e of entries) {
    const refs = Array.isArray(e.refImages) ? e.refImages : []
    for (const r of refs) {
      refCount += 1
      if (typeof r?.dataUrl === 'string') refBytes += approxDataUrlBytes(r.dataUrl)
    }
  }

  return {
    imageCount,
    imageBytes,
    historyCount: entries.length,
    historyBytes,
    refCount,
    refBytes,
    totalBytes: imageBytes + historyBytes,
    userDataDir: userDataDir(),
    imagesDir: dir,
  }
}

// 只清生成图文件（images/*.png），历史条目保留（条目里的图会显示为缺失，由 UI 兜底）。
export function clearGeneratedImages(): CacheStats {
  const dir = imagesDir()
  try {
    for (const f of readdirSync(dir)) {
      try { unlinkSync(join(dir, f)) } catch { /* ignore */ }
    }
  } catch { /* dir 可能不存在，没问题 */ }
  return getCacheStats()
}

// 只剥离历史条目里的参考图快照（refImages 置空），生成图 + 历史索引都保留。
// 这是 history.json 膨胀的主因：每张参考图快照约几百 KB ~ 数 MB。
export function clearRefCache(): CacheStats {
  const arr = readIndex()
  let changed = false
  for (const e of arr) {
    if (Array.isArray(e.refImages) && e.refImages.length > 0) {
      e.refImages = []
      changed = true
    }
  }
  if (changed) writeIndex(arr)
  return getCacheStats()
}

// 全部清空：生成图 + 历史索引（含快照）。等价于老 clearHistory，但返回最新统计。
export function clearAllCache(): CacheStats {
  const dir = imagesDir()
  try {
    for (const f of readdirSync(dir)) {
      try { unlinkSync(join(dir, f)) } catch { /* ignore */ }
    }
  } catch { /* dir 可能不存在，没问题 */ }
  writeIndex([])
  return getCacheStats()
}

// 弹原生保存框，把 userData/images/filename 拷一份到用户选的位置
export async function downloadHistoryFile(filename: string): Promise<void> {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const src = join(imagesDir(), filename)
  if (!existsSync(src)) throw new Error('源文件不存在')
  const dot = filename.lastIndexOf('.')
  const ext = dot > 0 ? filename.slice(dot) : '.png'
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const result = await dialog.showSaveDialog(win ?? undefined!, {
    title: '保存原图',
    defaultPath: `${filename.replace(/\.[^.]+$/, '')}_${stamp}${ext}`,
    filters: [{ name: '图片', extensions: [ext.replace('.', '')] }],
  })
  if (result.canceled || !result.filePath) return
  const bytes = readFileSync(src)
  writeFileSync(result.filePath, bytes)
}

// 用户一次下载当前生成的全部 plate。弹"选目录"对话框，把每一张
// plate 拷到那个目录下，文件名保持原 filename。Cancel 是 no-op。
//
// 冲突处理：先把任务分成"无冲突"和"有冲突"两组。
// - 全部不冲突 → 直接写，没打扰
// - 有冲突 → 弹原生「保留两者 / 替换 / 取消」对话框
//   - 保留两者：旧文件不动，新文件用 `image 2.png` 这种名字另存
//   - 替换：覆盖
//   - 取消：什么都不做（包括未冲突的也不写）
export async function downloadHistoryFiles(filenames: string[]): Promise<void> {
  if (filenames.length === 0) return
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const result = await dialog.showOpenDialog(win ?? undefined!, {
    title: `保存全部 ${filenames.length} 张图`,
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: undefined,
  })
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) return
  const dir = result.filePaths[0]
  if (!dir) return

  // 收集 (src, dest, exists) 任务列表
  const tasks: Array<{ src: string; dest: string; exists: boolean }> = []
  for (const fn of filenames) {
    const src = join(imagesDir(), fn)
    if (!existsSync(src)) continue
    const dest = join(dir, fn)
    tasks.push({ src, dest, exists: existsSync(dest) })
  }
  if (tasks.length === 0) return

  const conflicts = tasks.filter((t) => t.exists)
  const newFiles = tasks.filter((t) => !t.exists)

  // 全部不冲突 → 直接写入
  if (conflicts.length === 0) {
    for (const t of tasks) {
      writeFileSync(t.dest, readFileSync(t.src))
    }
    return
  }

  // 有冲突 → 询问「保留两者 / 替换 / 取消」
  const choice = await dialog.showMessageBox(win ?? undefined!, {
    type: 'question',
    title: '部分文件已存在',
    message: `目标目录中已有 ${conflicts.length} 张同名图片`,
    detail:
      `未冲突的 ${newFiles.length} 张会直接保存。\n\n` +
      `冲突文件:\n${conflicts.map((c) => '  • ' + basename(c.dest)).join('\n')}\n\n` +
      `选择「保留两者」会用新名字（如 "image 2.png"）保存，不覆盖旧文件。`,
    buttons: ['保留两者', '替换', '取消'],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
  })

  if (choice.response === 2) return  // 取消：什么都不做

  if (choice.response === 1) {
    // 替换：全部覆盖
    for (const t of tasks) {
      writeFileSync(t.dest, readFileSync(t.src))
    }
    return
  }

  // 保留两者：未冲突的直接写；冲突的写到新名字
  for (const t of newFiles) {
    writeFileSync(t.dest, readFileSync(t.src))
  }
  for (const t of conflicts) {
    const newDest = nextAvailableName(t.dest)
    writeFileSync(newDest, readFileSync(t.src))
  }
}

// 找一个不冲突的下一个文件名："foo.png" -> "foo 2.png" -> "foo 3.png" ...
// 仿 macOS Finder 的"保留两者"命名习惯。
function nextAvailableName(dest: string): string {
  if (!existsSync(dest)) return dest
  const ext = extname(dest)
  const base = dest.slice(0, dest.length - ext.length)
  for (let i = 2; i < 10000; i++) {
    const candidate = `${base} ${i}${ext}`
    if (!existsSync(candidate)) return candidate
  }
  // 极端兜底：10000 个都还在，收一个时间戳
  return `${base} ${Date.now()}${ext}`
}
