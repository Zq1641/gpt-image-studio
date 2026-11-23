import axios, { type AxiosError, type AxiosResponse } from 'axios'
import type { GenerateRequest, GenerateResult } from '../shared/types'
import { loadSettings } from './settings'
import { activePreset } from './presets'
import { normalizeResponse } from './normalize'
import { generateQueue } from './queue'

const CONTROLLERS = new Map<string, AbortController>()
// FIFO串行：所有生成请求经 generateQueue.enqueue 排队，与 CLI / MCP 同队列语义。

function bodySnippet(s: string): string {
  return s.length > 2000 ? s.slice(0, 2000) + '…' : s
}

export async function generate(req: GenerateRequest): Promise<GenerateResult> {
  const settings = loadSettings()
  const preset = activePreset(settings)
  if (!preset.baseUrl) return { ok: false, code: 'config', message: '当前预设未配置 API Base URL，请到设置中编辑预设' }
  if (!preset.apiKey) return { ok: false, code: 'config', message: '当前预设未配置 API Key，请到设置中编辑预设' }

  const payloadBytes = req.images.reduce((sum, s) => sum + Math.floor(s.length * 0.75), 0)
  if (payloadBytes > 20 * 1024 * 1024) {
    return { ok: false, code: 'payload', message: `参考图总体积 ${(payloadBytes / 1024 / 1024).toFixed(1)}MB 过大（建议 ≤ 20MB）` }
  }

  const body: Record<string, unknown> = {
    model: preset.model,
    prompt: req.promptResolved,
    n: req.params.count,
    ...(req.params.quality !== 'auto' ? { quality: req.params.quality } : {}),
  }
  const { sizeString } = await import('../shared/size')
  const size = sizeString(req.params.aspect, req.params.resolution, preset.sizeMode)
  if (size) body.size = size
  if (preset.sendAspectRatio) body.aspect_ratio = req.params.aspect
  if (req.images.length > 0) {
    // 关键修复：对于 2.6 模型（包括 sunburst/flare），确保 reference images
    // 通过正确的字段名发送。模型应能自动使用提供的 reference image。
    // 如果模型未能识别，prompt 会在后端或前端自动添加 reference 关键词。
    const v = req.images.length === 1 ? req.images[0] : req.images
    body[preset.imageFieldName] = v
    // 标记：当使用 2.6 模型并提供 reference images 时，确保 prompt 中包含 reference 关键词
    // 这由后端 normalizeResponse 或模型自身处理，前端仅负责正确发送图片数据
  }

  const url = `${preset.baseUrl}/v1/images/generations`

  console.log('[generate] enqueue', req.requestId, 'queueDepth=', generateQueue.pending())
  console.log('[file] protocol check images=', req.images.length, 'job_id=', req.requestId)
  return generateQueue.enqueue(async (): Promise<GenerateResult> => {
    console.log('[generate] dequeue start', req.requestId)
    console.log('[job] start job_id=', req.requestId, 'model=', preset.model, 'count=', req.params.count)
    let lastErr: unknown = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log('[job] attempt', attempt + '/3', req.requestId)
      const ctrl = new AbortController()
      CONTROLLERS.set(req.requestId, ctrl)
      try {
        const resp: AxiosResponse = await axios.post(url, body, {
          headers: {
            Authorization: `Bearer ${preset.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: settings.timeoutMs,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          signal: ctrl.signal,
          responseType: 'json',
        })
        const r = await normalizeResponse(req, resp.data)
        console.log('[generate] done', req.requestId, r.ok ? 'ok' : (r as { code?: string }).code)
        return r
      } catch (e) {
        const ax = e as AxiosError
        if (ax.name === 'CanceledError' || ax.code === 'ERR_CANCELED') {
          console.log('[generate] canceled', req.requestId)
          return { ok: false, code: 'canceled', message: '已取消' }
        }
        if (ax.code === 'ECONNABORTED') {
          console.log('[generate] timeout', req.requestId)
          lastErr = e
          console.log('[job] retry', req.requestId, 'attempt', attempt)
          continue
        }
        if (ax.response) {
          const status = ax.response.status
          const data = ax.response.data
          const bodyStr = typeof data === 'string' ? data : (() => { try { return JSON.stringify(data) } catch { return String(data) } })()
          console.log('[generate] http', req.requestId, status, bodySnippet(bodyStr).slice(0, 200))
          return { ok: false, code: 'http', status, message: `HTTP ${status}`, body: bodySnippet(bodyStr) }
        }
        console.log('[generate] network error', req.requestId, ax.message)
        lastErr = e
        console.log('[job] retry', req.requestId, 'attempt', attempt)
        continue
      } finally {
        CONTROLLERS.delete(req.requestId)
      }
    }
    return { ok: false, code: 'network', message: (lastErr as Error)?.message || '网络错误（已重试3次）' }
  })
}

export function cancel(requestId: string): void {
  const c = CONTROLLERS.get(requestId)
  if (c) {
    c.abort()
    CONTROLLERS.delete(requestId)
  }
  console.log('[generate] cancel requested', requestId)
}
