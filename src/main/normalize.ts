import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type { GenerateRequest, GenerateResult, HistoryEntry } from '../shared/types'
import { sizeString } from '../shared/size'
import { loadSettings } from './settings'
import { activePreset } from './presets'

interface RawImage {
  file: string
  url: string
  width?: number
  height?: number
  mime: 'image/png'
  bytes: number
}

function id(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function safeId(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function imagesDir(): string {
  const d = join(app.getPath('userData'), 'images')
  mkdirSync(d, { recursive: true })
  return d
}

// URL 回包下载：60s 超时 + 50MB 体积上限。
// 之前是裸 net.request：中转站返回超大/假死 URL 会一直挂着不回来，
// 内存里攒 Buffer 也可能把主进程撑爆。超限直接报 io 错，不写盘、不进历史。
const URL_DOWNLOAD_TIMEOUT_MS = 60_000
const URL_DOWNLOAD_MAX_BYTES = 50 * 1024 * 1024

async function downloadIfUrl(url: string): Promise<{ data: Buffer; mime: string } | { ok: false }> {
  try {
    const { net } = await import('electron')
    const res = await new Promise<{ data: Buffer; mime: string } | { ok: false }>((resolve) => {
      let settled = false
      const done = (v: { data: Buffer; mime: string } | { ok: false }) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(v)
      }
      const timer = setTimeout(() => {
        try { (req as unknown as { abort?: () => void }).abort?.() } catch { /* ignore */ }
        done({ ok: false })
      }, URL_DOWNLOAD_TIMEOUT_MS)
      const req = net.request({ url, method: 'GET', redirect: 'follow' })
      const chunks: Buffer[] = []
      let received = 0
      let mime = 'image/png'
      req.on('response', (resp) => {
        const status = resp.statusCode
        if (typeof status === 'number' && (status < 200 || status >= 400)) {
          done({ ok: false })
          return
        }
        // Content-Length 先验：超限直接掐掉，连 body 都不收
        const cl = resp.headers['content-length']
        const declared = Array.isArray(cl) ? cl[0] : cl
        if (typeof declared === 'string' && /^\d+$/.test(declared.trim())) {
          if (Number(declared) > URL_DOWNLOAD_MAX_BYTES) {
            try { (req as unknown as { abort?: () => void }).abort?.() } catch { /* ignore */ }
            done({ ok: false })
            return
          }
        }
        const ct = resp.headers['content-type']
        if (typeof ct === 'string') mime = ct.split(';')[0] || mime
        resp.on('data', (c) => {
          received += (c as Buffer).length
          if (received > URL_DOWNLOAD_MAX_BYTES) {
            try { (req as unknown as { abort?: () => void }).abort?.() } catch { /* ignore */ }
            done({ ok: false })
            return
          }
          chunks.push(c as Buffer)
        })
        resp.on('end', () => done({ data: Buffer.concat(chunks), mime }))
        resp.on('error', () => done({ ok: false }))
      })
      req.on('error', () => done({ ok: false }))
      req.end()
    })
    if (!('ok' in res && res.ok === false)) {
      return res
    }
  } catch { /* fallback to axios */ }

  try {
    const axios = (await import('axios')).default
    const resp = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: URL_DOWNLOAD_TIMEOUT_MS,
      maxContentLength: URL_DOWNLOAD_MAX_BYTES,
      maxBodyLength: URL_DOWNLOAD_MAX_BYTES,
    })
    const mime = (resp.headers['content-type'] as string)?.split(';')[0] || 'image/png'
    return { data: Buffer.from(resp.data), mime }
  } catch (e) {
    console.error('[downloadIfUrl] download failed for URL:', url.slice(0, 80), e)
    return { ok: false }
  }
}

export async function normalizeResponse(req: GenerateRequest, raw: unknown): Promise<GenerateResult> {
  const images = extractImages(raw)
  if (images.length === 0) {
    const bodyStr = typeof raw === 'string' ? raw : (() => { try { return JSON.stringify(raw) } catch { return String(raw) } })()
    return { ok: false, code: 'parse', message: '未识别的响应格式', body: bodyStr.slice(0, 2000) }
  }

  // If the proxy returned FEWER images than we asked for, the upstream model
  // probably capped `n` silently (or the proxy dropped a plate while
  // re-wrapping the response). Log it loudly so a developer running with
  // DevTools open sees what really came back — and include it in the user-
  // facing message so the discrepancy isn't hidden.
  const requested = req.params.count
  if (images.length < requested) {
    console.warn(`[normalize] requested ${requested} image(s), proxy returned ${images.length}`)
  }

  const entry: HistoryEntry = {
    id: id(),
    createdAt: Date.now(),
    presetName: activePreset(loadSettings()).name,
    model: activePreset(loadSettings()).model,
    promptRaw: req.promptRaw,
    promptResolved: req.promptResolved,
    params: req.params,
    size: sizeString(req.params.aspect, req.params.resolution, 'computed'),
    refImageFiles: [],
    // 参考图快照随历史持久化，回填时可直接恢复（老条目没有则为空）。
    // 注意体积：快照是 JPEG dataUrl，history.json 会随条目线性变大，
    // 瘦身请用 Cache 弹窗的“参考图快照”清理（只剥快照、不动历史）。
    refImages: Array.isArray(req.refImages) ? req.refImages : [],
    images: [],
  }

  const dir = imagesDir()
  const saved: RawImage[] = []
  for (let i = 0; i < images.length; i++) {
    const img = images[i]
    if (!img) continue
    const name = `${safeId(req.requestId)}-${i}.png`
    try {
      if (img.kind === 'b64') {
        const bytes = Buffer.from(img.data, 'base64')
        writeFileSync(join(dir, name), bytes)
        saved.push({ file: name, url: `img://${name}`, mime: 'image/png', bytes: bytes.length })
        console.log('[localFile] saved', name, bytes.length + 'B', `img://${name}`);
      } else {
        const got = await downloadIfUrl(img.url)
        if ('ok' in got) {
          return { ok: false, code: 'io', message: '下载生成图片失败（超时或文件过大，限 60s / 50MB）' }
        }
        writeFileSync(join(dir, name), got.data)
        saved.push({ file: name, url: `img://${name}`, mime: 'image/png', bytes: got.data.length })
      }
    } catch (e) {
      return { ok: false, code: 'io', message: `写入图片失败：${(e as Error).message}` }
    }
  }

  entry.images = saved.map((s) => ({ file: s.file, url: s.url }))
  console.log('[job] job_id=', req.requestId, 'saved', saved.length + '/' + images.length, 'size=', req.params.aspect, req.params.resolution);
  console.log('[file] protocol img:// files=', saved.map((s) => s.file).slice(0, 4).join(','));
  return { ok: true, entry }
}

type Extracted = { kind: 'b64'; data: string } | { kind: 'url'; url: string }

// Pull every image we can find out of an arbitrary response object.
//
// Proxies in the wild wrap OpenAI-style responses in many shapes. We used
// to only handle the canonical `{ data: [{ b64_json }, ...] }` and top-level
// `b64_json` / `url` fallbacks. That dropped images silently when a proxy
// used e.g. `{ data: { b64_json: ["...", "..."] } }` (data is an OBJECT,
// not an array) or wrapped urls differently, so a 2-image request would
// surface only 1 — and the user saw "API charged for 2 but UI shows 1".
//
// This walker accepts the canonical format plus the common wrappers:
//   - canonical array:   { data: [{ b64_json } | { url }, ...] }
//   - alt array keys:    { images: [...] }, { output: [...] }, { result: [...] }
//   - data-as-object:    { data: { b64_json: "..." | [...] } }
//                        { data: { url: "..." | [...] } }
//                        { data: { images: [...] } }
//   - top-level scalar:  { b64_json: "..." }, { url: "..." }
//   - top-level array:   { b64_json: ["...", "..."] }, { url: ["...", "..."] }
function extractImages(raw: unknown): Extracted[] {
  if (!raw || typeof raw !== 'object') return []
  const out: Extracted[] = []
  const r = raw as Record<string, unknown>

  const pushStrings = (v: unknown, kind: 'b64' | 'url') => {
    if (typeof v === 'string' && v.length > 0) {
      out.push(kind === 'b64' ? { kind: 'b64', data: v } : { kind: 'url', url: v })
    } else if (Array.isArray(v)) {
      for (const x of v) {
        if (typeof x === 'string' && x.length > 0) {
          out.push(kind === 'b64' ? { kind: 'b64', data: x } : { kind: 'url', url: x })
        }
      }
    }
  }

  const arrayKeys = ['data', 'images', 'output', 'result']
  for (const key of arrayKeys) {
    const v = r[key]
    if (Array.isArray(v)) {
      for (const item of v) {
        if (!item || typeof item !== 'object') continue
        const it = item as Record<string, unknown>
        if (typeof it.b64_json === 'string') out.push({ kind: 'b64', data: it.b64_json })
        else if (typeof it.url === 'string') out.push({ kind: 'url', url: it.url })
      }
    } else if (v && typeof v === 'object') {
      // data-as-object: { data: { b64_json: ... | [...] } } etc.
      const inner = v as Record<string, unknown>
      pushStrings(inner.b64_json, 'b64')
      pushStrings(inner.url, 'url')
      if (Array.isArray(inner.images)) {
        for (const item of inner.images) {
          if (!item || typeof item !== 'object') continue
          const it = item as Record<string, unknown>
          if (typeof it.b64_json === 'string') out.push({ kind: 'b64', data: it.b64_json })
          else if (typeof it.url === 'string') out.push({ kind: 'url', url: it.url })
        }
      }
    }
  }

  // Top-level scalar / array fallbacks.
  pushStrings(r.b64_json, 'b64')
  pushStrings(r.url, 'url')

  // Dedup by content (some proxies duplicate b64_json at top-level AND
  // inside data — we'd otherwise write the same plate twice).
  const seen = new Set<string>()
  return out.filter((e) => {
    const key = e.kind === 'b64' ? `b:${e.data.slice(0, 64)}:${e.data.length}` : `u:${e.url}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
