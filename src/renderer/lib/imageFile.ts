import type { RefImage } from '@shared/types'

const ALLOWED: RefImage['mime'][] = ['image/jpeg', 'image/png', 'image/webp']
const MAX_LONG_EDGE = 2048
const QUALITY = 0.92

// renderer禁止/Users绝对路径上屏
// 真实src打日志便于定位，img onError负责兜底。
export function isSafeRenderSrc(s: string): boolean {
  return !(s || '').includes('/Users/');
}

function nanoid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export async function fileToRefImage(file: File): Promise<RefImage> {
  if (!ALLOWED.includes(file.type as RefImage['mime'])) {
    throw new Error(`不支持的图片格式：${file.type || file.name}`)
  }
  const dataUrl = await readAsDataURL(file)
  const img = await loadImage(dataUrl)
  const { canvas, w, h } = downscale(img, MAX_LONG_EDGE)
  const out = canvas.toDataURL('image/jpeg', QUALITY)
  const localPath = (file as File & { path?: string }).path ?? '';
  console.log('[localFile] pick', file.name, w + 'x' + h, approxBytes(out) + 'B', localPath ? 'has-path' : 'no-path');
  return {
    id: nanoid(),
    index: 0, // assigned by caller after re-numbering
    name: file.name,
    mime: 'image/jpeg',
    dataUrl: out,
    width: w,
    height: h,
    bytes: approxBytes(out),
  }
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(new Error('读取图片失败'))
    r.onload = () => resolve(r.result as string)
    r.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片解码失败'))
    img.src = src
  })
}

function downscale(img: HTMLImageElement, maxLong: number) {
  const long = Math.max(img.naturalWidth, img.naturalHeight)
  if (long <= maxLong) {
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    return { canvas, w: img.naturalWidth, h: img.naturalHeight }
  }
  const ratio = maxLong / long
  const w = Math.round(img.naturalWidth * ratio)
  const h = Math.round(img.naturalHeight * ratio)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  return { canvas, w, h }
}

function approxBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',')
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl
  return Math.floor(b64.length * 0.75)
}
