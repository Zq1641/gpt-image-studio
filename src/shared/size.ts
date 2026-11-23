import type { AspectRatio, Resolution, SizeMode } from './types'

const RATIO: Record<AspectRatio, [number, number]> = {
  '21:9': [21, 9],
  '16:9': [16, 9],
  '3:2': [3, 2],
  '4:3': [4, 3],
  '1:1': [1, 1],
  '3:4': [3, 4],
  '2:3': [2, 3],
  '9:16': [9, 16],
}

const LONG_EDGE: Record<string, number> = { '1K': 1024, '2K': 2048, '4K': 4096, '6K': 6144, '8K': 8192 }

function snap64(n: number): number {
  return Math.max(64, Math.round(n / 64) * 64)
}

function isWxH(r: string): boolean {
  return /^\d+x\d+$/.test(r)
}

export function computeSize(aspect: AspectRatio, resolution: Resolution): string {
  // auto：上层省略 size，让服务端默认；WxH：直接透传
  if (resolution === 'auto') return ''
  if (typeof resolution === 'string' && isWxH(resolution)) return resolution
  const long = LONG_EDGE[resolution as string]
  // 防御：未知档回退到 1K，不断裂
  const base = typeof long === 'number' ? long : 1024
  const [w, h] = RATIO[aspect]
  const short = snap64((base * Math.min(w, h)) / Math.max(w, h))
  return w >= h ? `${base}x${short}` : `${short}x${base}`
}

export function sizeString(aspect: AspectRatio, resolution: Resolution, mode: SizeMode): string {
  if (mode === 'omit') return ''
  if (typeof resolution === 'string' && isWxH(resolution)) return resolution
  if (resolution === 'auto') return ''
  if (mode === 'square') {
    const long = LONG_EDGE[resolution as string] ?? 1024
    return `${long}x${long}`
  }
  return computeSize(aspect, resolution)
}
