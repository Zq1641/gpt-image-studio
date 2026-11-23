#!/usr/bin/env node
// CLI 薄封装（唯一核心在 src/shared/headless-schema.ts）
// 职责只有三件：解析 argv -> 交给单核心校验/组装 -> 走共用 FIFO 串行发请求并落盘。
import axios from 'axios'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseHeadlessParams, buildImageBody, estimatePayloadBytes } from '../shared/headless-schema'
import type { PresetLike } from '../shared/headless-schema'
import { generateQueue } from '../main/queue'
import { costPreview } from '../main/cost'

const MAX_PAYLOAD_BYTES = 20 * 1024 * 1024

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf('--' + name)
  if (i < 0) return undefined
  return process.argv[i + 1]
}

function flag(name: string): boolean {
  return process.argv.includes('--' + name)
}

function collectImages(): string[] {
  const out: string[] = []
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] !== '--image') continue
    const v = process.argv[i + 1]
    if (typeof v === 'string' && v.length > 0) out.push(v)
  }
  return out
}

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

async function main(): Promise<void> {
  const model = argValue('model') ?? process.env['GPT_IMAGE_MODEL'] ?? 'gpt-image-2'
  const countArg = argValue('count')
  const parsed = parseHeadlessParams(
    {
      prompt: argValue('prompt') ?? process.env['GPT_IMAGE_PROMPT'] ?? '',
      aspect: argValue('aspect'),
      resolution: argValue('resolution'),
      quality: argValue('quality'),
      count: countArg === undefined ? undefined : Number(countArg),
      images: collectImages(),
      complexity: argValue('complexity'),
      size: argValue('size'),
      model: model,
    },
    model,
  )
  if (!parsed.ok) {
    console.error('ERR ' + parsed.message)
    process.exitCode = 2
    return
  }
  const params = parsed.params
  const payloadBytes = estimatePayloadBytes(params.images)
  if (payloadBytes > MAX_PAYLOAD_BYTES) {
    console.error('ERR 参考图总体积 ' + (payloadBytes / 1024 / 1024).toFixed(1) + 'MB 过大（建议不超过 20MB）')
    process.exitCode = 2
    return
  }

  const preset: PresetLike = {
    model: model,
    imageFieldName: 'image',
    sizeMode: 'computed',
    sendAspectRatio: !flag('no-aspect'),
  }
  const body = buildImageBody(params, preset, params.prompt)
  const price = Number(process.env['GPT_IMAGE_PRICE'] ?? '0')
  console.info(costPreview(params.count, Number.isFinite(price) ? price : 0))
  console.info(JSON.stringify(body, null, 2))

  const baseUrl = (argValue('baseUrl') ?? process.env['GPT_IMAGE_BASE_URL'] ?? '').replace(/\/$/, '')
  const apiKey = argValue('apiKey') ?? process.env['GPT_IMAGE_API_KEY'] ?? ''
  if (flag('dry-run') || !baseUrl || !apiKey) {
    if (!flag('dry-run')) console.info('未配置 baseUrl/apiKey，仅输出请求体（dry-run）')
    return
  }

  const timeoutRaw = Number(process.env['GPT_IMAGE_TIMEOUT_MS'] ?? '600000')
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
  if (items.length === 0) {
    console.error('ERR 未能从响应中识别到图片数据（b64_json）')
    process.exitCode = 3
    return
  }
  const outDir = argValue('out') ?? process.env['GPT_IMAGE_OUT'] ?? join(process.cwd(), 'output')
  mkdirSync(outDir, { recursive: true })
  const stamp = Date.now()
  items.forEach((b64, index) => {
    const file = join(outDir, stamp + '-' + index + '.png')
    writeFileSync(file, Buffer.from(b64, 'base64'))
    console.info('saved ' + file)
  })
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e)
  console.error('ERR ' + msg)
  process.exitCode = 1
})
