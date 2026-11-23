import { describe, expect, it } from 'vitest'
import {
  parseHeadlessParams,
  buildImageBody,
  estimatePayloadBytes,
  isAspect,
  isResolution,
  isCount,
} from '../shared/headless-schema'
import type { PresetLike } from '../shared/headless-schema'
import { FifoQueue } from './queue'
import { costPreview, estimateCost, formatCNY } from './cost'

const legacyPreset: PresetLike = {
  model: 'gpt-image-2',
  imageFieldName: 'image',
  sizeMode: 'computed',
  sendAspectRatio: true,
}

const flarePreset: PresetLike = {
  model: 'gpt-image-2.6-flare',
  imageFieldName: 'image',
  sizeMode: 'computed',
  sendAspectRatio: true,
}

describe('headless-schema — 参数校验（CLI/MCP/Electron 唯一入口）', () => {
  it('prompt 为空直接拒绝', () => {
    const r = parseHeadlessParams({ prompt: '   ' })
    expect(r.ok).toBe(false)
  })

  it('缺省值：1:1 + auto + medium + 1 张', () => {
    const r = parseHeadlessParams({ prompt: '一只猫' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.params.aspect).toBe('1:1')
    expect(r.params.resolution).toBe('auto')
    expect(r.params.quality).toBe('medium')
    expect(r.params.count).toBe(1)
    expect(r.params.images).toEqual([])
  })

  it('老四模型不收 xhigh/max，2.6 收六档', () => {
    expect(parseHeadlessParams({ prompt: 'x', quality: 'max' }, 'gpt-image-2').ok).toBe(false)
    expect(parseHeadlessParams({ prompt: 'x', quality: 'xhigh' }, 'dall-e-3').ok).toBe(false)
    expect(parseHeadlessParams({ prompt: 'x', quality: 'max' }, 'gpt-image-2.6-sunburst').ok).toBe(true)
    expect(parseHeadlessParams({ prompt: 'x', quality: 'xhigh' }, 'gpt-image-2.6-flare').ok).toBe(true)
  })

  it('非法枚举值一律拒绝', () => {
    expect(parseHeadlessParams({ prompt: 'x', aspect: '5:4' }).ok).toBe(false)
    expect(parseHeadlessParams({ prompt: 'x', resolution: '8K' }).ok).toBe(true)
    expect(parseHeadlessParams({ prompt: 'x', count: 5 }).ok).toBe(false)
    expect(parseHeadlessParams({ prompt: 'x', count: 0 }).ok).toBe(false)
    expect(parseHeadlessParams({ prompt: 'x', images: ['ok', 1] }).ok).toBe(false)
  })

  it('WxH 与 1K/2K/4K 均放行', () => {
    expect(isResolution('auto')).toBe(true)
    expect(isResolution('4K')).toBe(true)
    expect(isResolution('1536x1024')).toBe(true)
    expect(isResolution('15x10x2')).toBe(false)
    expect(isAspect('21:9')).toBe(true)
    expect(isCount(4)).toBe(true)
  })

  it('complexity/size/model 原样透传', () => {
    const r = parseHeadlessParams(
      { prompt: 'x', complexity: 'highdetail', size: '1024x1024', model: 'gpt-image-2.6-flare' },
      'gpt-image-2.6-flare',
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.params.complexity).toBe('highdetail')
    expect(r.params.sizeOverride).toBe('1024x1024')
    expect(r.params.modelOverride).toBe('gpt-image-2.6-flare')
  })

  it('prompt 超长拒绝（限 8000 字符）', () => {
    const long = 'a'.repeat(8001)
    expect(parseHeadlessParams({ prompt: long }).ok).toBe(false)
  })
})

describe('headless-schema — 请求体组装', () => {
  it('quality=auto 时不下发 quality 字段', () => {
    const r = parseHeadlessParams({ prompt: 'x', quality: 'auto' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const body = buildImageBody(r.params, legacyPreset, 'x')
    expect('quality' in body).toBe(false)
  })

  it('16:9 @ 2K 走计算尺寸，并带 aspect_ratio', () => {
    const r = parseHeadlessParams({ prompt: 'x', aspect: '16:9', resolution: '2K' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const body = buildImageBody(r.params, legacyPreset, 'x')
    expect(body['size']).toBe('2048x1152')
    expect(body['aspect_ratio']).toBe('16:9')
    expect(body['model']).toBe('gpt-image-2')
  })

  it('显式 size 覆盖自动计算', () => {
    const r = parseHeadlessParams({ prompt: 'x', resolution: '4K', size: '1536x864' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const body = buildImageBody(r.params, legacyPreset, 'x')
    expect(body['size']).toBe('1536x864')
  })

  it('preset 关掉 aspect_ratio 就不下发', () => {
    const r = parseHeadlessParams({ prompt: 'x', aspect: '9:16' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const body = buildImageBody(r.params, { ...legacyPreset, sendAspectRatio: false }, 'x')
    expect('aspect_ratio' in body).toBe(false)
  })

  it('单图传字符串，多图传数组，字段名跟随 preset', () => {
    const one = parseHeadlessParams({ prompt: 'x', images: ['AAAA'] })
    const two = parseHeadlessParams({ prompt: 'x', images: ['AAAA', 'BBBB'] })
    expect(one.ok && two.ok).toBe(true)
    if (!one.ok || !two.ok) return
    expect(buildImageBody(one.params, legacyPreset, 'x')['image']).toBe('AAAA')
    expect(buildImageBody(two.params, { ...legacyPreset, imageFieldName: 'images' }, 'x')['images']).toEqual([
      'AAAA',
      'BBBB',
    ])
  })

  it('2.6 六档 quality 直通到 body', () => {
    const r = parseHeadlessParams({ prompt: 'x', quality: 'max', count: 2 }, 'gpt-image-2.6-flare')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const body = buildImageBody(r.params, flarePreset, 'x')
    expect(body['quality']).toBe('max')
    expect(body['n']).toBe(2)
    expect(body['model']).toBe('gpt-image-2.6-flare')
  })

  it('payload 体积按 0.75 估算', () => {
    expect(estimatePayloadBytes([])).toBe(0)
    expect(estimatePayloadBytes(['A'.repeat(4000)])).toBe(3000)
  })
})

describe('cost — 成本预估', () => {
  it('总价 = 单价 x 张数', () => {
    expect(estimateCost(3, 0.5)).toBe(1.5)
    expect(estimateCost(0, 9)).toBe(0)
  })

  it('非法数字一律归零，不抛错', () => {
    expect(estimateCost(Number.NaN, 1)).toBe(0)
    expect(estimateCost(1, Number.NaN)).toBe(0)
  })

  it('展示文案带张数', () => {
    expect(formatCNY(1.5)).toBe('¥1.50')
    expect(costPreview(2, 0.25)).toBe('¥0.50（2 张 x ¥0.25/张）')
  })
})

describe('FifoQueue — 共用串行队列', () => {
  it('严格按入队顺序串行执行', async () => {
    const q = new FifoQueue()
    const order: number[] = []
    const first = q.enqueue(async () => {
      order.push(1)
      await new Promise((resolve) => setTimeout(resolve, 20))
      order.push(2)
    })
    const second = q.enqueue(async () => {
      order.push(3)
    })
    await Promise.all([first, second])
    expect(order).toEqual([1, 2, 3])
    expect(q.pending()).toBe(0)
  })

  it('队内任务抛错不阻塞后续任务', async () => {
    const q = new FifoQueue()
    const bad = q.enqueue(async () => {
      throw new Error('boom')
    })
    await expect(bad).rejects.toThrow('boom')
    const good = await q.enqueue(async () => 42)
    expect(good).toBe(42)
    expect(q.pending()).toBe(0)
  })

  it('入队后 pending 计数可见', async () => {
    const q = new FifoQueue()
    const t = q.enqueue(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    expect(q.pending()).toBe(1)
    await t
    expect(q.pending()).toBe(0)
  })
})
