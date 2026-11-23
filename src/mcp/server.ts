#!/usr/bin/env node
// MCP 薄封装：stdio JSON-RPC 2.0，零新增依赖。
// 参数校验、请求体组装、FIFO 串行、成本预估全部复用单核心，本文件只做协议编解码。
import axios from 'axios'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { parseHeadlessParams, buildImageBody, estimatePayloadBytes } from '../shared/headless-schema'
import type { PresetLike } from '../shared/headless-schema'
import { generateQueue } from '../main/queue'
import { costPreview } from '../main/cost'
import type { ImageFieldName, SizeMode } from '../shared/types'

const SERVER_NAME = 'gpt-image-studio'
const SERVER_VERSION = '0.2.0'
const PROTOCOL_VERSION = '2024-11-05'
const MAX_PAYLOAD_BYTES = 20 * 1024 * 1024

function env(key: string, fallback: string): string {
  const v = process.env[key]
  return v === undefined || v === '' ? fallback : v
}

function asImageField(v: string): ImageFieldName {
  if (v === 'images' || v === 'image_url') return v
  return 'image'
}

function asSizeMode(v: string): SizeMode {
  if (v === 'square' || v === 'omit') return v
  return 'computed'
}

const TOOLS = [
  {
    name: 'generate_image',
    description: '用已配置的中转站生成图片并落盘到本地目录，返回文件路径与预估成本。',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '提示词，必填' },
        aspect: {
          type: 'string',
          enum: ['21:9', '16:9', '3:2', '4:3', '1:1', '3:4', '2:3', '9:16'],
          description: '画面比例，默认 1:1',
        },
        resolution: { type: 'string', description: 'auto / 1K / 2K / 4K / WxH' },
        quality: {
          type: 'string',
          enum: ['auto', 'low', 'medium', 'high', 'xhigh', 'max'],
          description: '画质档；老四模型只认 auto/low/medium/high',
        },
        count: { type: 'integer', minimum: 1, maximum: 4, description: '张数，1-4' },
        images: { type: 'array', items: { type: 'string' }, description: '参考图 base64 或 dataURL' },
        complexity: { type: 'string', description: '原样透传给上游的可选字段' },
        size: { type: 'string', description: '显式尺寸 WxH，给则覆盖自动计算' },
        model: { type: 'string', description: '覆盖默认模型' },
        dryRun: { type: 'boolean', description: '只返回请求体与成本，不真正发请求' },
      },
      required: ['prompt'],
    },
  },
]

function extractB64(raw: unknown): string[] {
  const out: string[] = []
  if (!raw || typeof raw !== 'object') return out
  const root = raw as Record<string, unknown>
  const data = root['data']
  if (Array.isArray(data)) {
    for (const item of data) {
      if (!item || typeof item !== 'object') continue
      const b64 = (item as Record<string, unknown>)['b64_json']
      if (typeof b64 === 'string' && b64.length > 0) out.push(b64)
    }
  }
  const top = root['b64_json']
  if (typeof top === 'string' && top.length > 0) out.push(top)
  else if (Array.isArray(top)) {
    for (const v of top) {
      if (typeof v === 'string' && v.length > 0) out.push(v)
    }
  }
  return out
}

async function runGenerate(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const model =
    typeof args['model'] === 'string' && args['model'].length > 0
      ? args['model']
      : env('GPT_IMAGE_MODEL', 'gpt-image-2')
  const parsed = parseHeadlessParams(args, model)
  if (!parsed.ok) return { ok: false, message: parsed.message }
  const params = parsed.params

  const payloadBytes = estimatePayloadBytes(params.images)
  if (payloadBytes > MAX_PAYLOAD_BYTES) {
    return {
      ok: false,
      message: '参考图总体积 ' + (payloadBytes / 1024 / 1024).toFixed(1) + 'MB 过大（建议不超过 20MB）',
    }
  }

  const preset: PresetLike = {
    model: model,
    imageFieldName: asImageField(env('GPT_IMAGE_IMAGE_FIELD', 'image')),
    sizeMode: asSizeMode(env('GPT_IMAGE_SIZE_MODE', 'computed')),
    sendAspectRatio: env('GPT_IMAGE_SEND_ASPECT', '1') !== '0',
  }
  const body = buildImageBody(params, preset, params.prompt)
  const priceRaw = Number(env('GPT_IMAGE_PRICE', '0'))
  const cost = costPreview(params.count, Number.isFinite(priceRaw) ? priceRaw : 0)

  const baseUrl = env('GPT_IMAGE_BASE_URL', '').replace(/\/$/, '')
  const apiKey = env('GPT_IMAGE_API_KEY', '')
  const dryRun = args['dryRun'] === true
  if (dryRun || !baseUrl || !apiKey) {
    return { ok: true, dryRun: true, body: body, cost: cost }
  }

  const timeoutRaw = Number(env('GPT_IMAGE_TIMEOUT_MS', '600000'))
  const timeoutMs = Number.isFinite(timeoutRaw) ? timeoutRaw : 600000
  const data = await generateQueue.enqueue(async () => {
    const resp = await axios.post(baseUrl + '/v1/images/generations', body, {
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      timeout: timeoutMs,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      responseType: 'json',
    })
    return resp.data as unknown
  })

  const items = extractB64(data)
  if (items.length === 0) return { ok: false, message: '未能从响应中识别到图片数据（b64_json）' }

  const outDir = env('GPT_IMAGE_OUT', join(process.cwd(), 'output'))
  mkdirSync(outDir, { recursive: true })
  const stamp = Date.now()
  const files: string[] = []
  items.forEach((b64, index) => {
    const file = join(outDir, stamp + '-' + index + '.png')
    writeFileSync(file, Buffer.from(b64, 'base64'))
    files.push(file)
  })
  return { ok: true, files: files, cost: cost, body: body }
}

function reply(id: unknown, result: unknown): void {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: id, result: result }) + '\n')
}

function replyError(id: unknown, code: number, message: string): void {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: id, error: { code: code, message: message } }) + '\n')
}

async function handle(msg: Record<string, unknown>): Promise<void> {
  const method = typeof msg['method'] === 'string' ? msg['method'] : ''
  const id = msg['id']
  const hasId = id !== undefined && id !== null
  const rawParams = msg['params']
  const params = rawParams && typeof rawParams === 'object' ? (rawParams as Record<string, unknown>) : {}

  if (method === 'initialize') {
    if (!hasId) return
    reply(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    })
    return
  }
  if (method === 'notifications/initialized' || method === 'initialized') return
  if (method === 'ping') {
    if (hasId) reply(id, {})
    return
  }
  if (method === 'tools/list') {
    if (!hasId) return
    reply(id, { tools: TOOLS })
    return
  }
  if (method === 'tools/call') {
    if (!hasId) return
    const name = typeof params['name'] === 'string' ? params['name'] : ''
    if (name !== 'generate_image') {
      replyError(id, -32602, '未知工具：' + name)
      return
    }
    const rawArgs = params['arguments']
    const callArgs = rawArgs && typeof rawArgs === 'object' ? (rawArgs as Record<string, unknown>) : {}
    try {
      const out = await runGenerate(callArgs)
      const text = JSON.stringify(out)
      if (out['ok'] === false) {
        reply(id, { content: [{ type: 'text', text: text }], isError: true })
      } else {
        reply(id, { content: [{ type: 'text', text: text }] })
      }
    } catch (e) {
      const msgText = e instanceof Error ? e.message : String(e)
      reply(id, { content: [{ type: 'text', text: 'ERR ' + msgText }], isError: true })
    }
    return
  }
  if (hasId) replyError(id, -32601, '未知方法：' + method)
}

function main(): void {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity })
  rl.on('line', (line: string) => {
    const text = line.trim()
    if (text.length === 0) return
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      replyError(null, -32700, 'JSON 解析失败')
      return
    }
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && typeof item === 'object') void handle(item as Record<string, unknown>)
      }
      return
    }
    if (parsed && typeof parsed === 'object') void handle(parsed as Record<string, unknown>)
  })
  rl.on('close', () => {
    process.exit(0)
  })
}

main()
