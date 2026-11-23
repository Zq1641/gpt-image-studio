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

const LONG_EDGE: Record<Resolution, number> = { '1K': 1024, '2K': 2048, '4K': 4096 }

function snap64(n: number): number {
  return Math.max(64, Math.round(n / 64) * 64)
}

export function computeSize(aspect: AspectRatio, resolution: Resolution): string {
  const [w, h] = RATIO[aspect]
  const long = LONG_EDGE[resolution]
  const short = snap64((long * Math.min(w, h)) / Math.max(w, h))
  return w >= h ? `${long}x${short}` : `${short}x${long}`
}

export function sizeString(aspect: AspectRatio, resolution: Resolution, mode: SizeMode): string {
  if (mode === 'omit') return ''
  if (mode === 'square') return `${LONG_EDGE[resolution]}x${LONG_EDGE[resolution]}`
  return computeSize(aspect, resolution)
}
