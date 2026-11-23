import { describe, expect, it, vi } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const testUserData = mkdtempSync(join(tmpdir(), 'gpt-image-e2e-'))

vi.mock('electron', () => ({
  app: {
    getPath: () => testUserData,
  },
  net: {
    request: () => ({
      on: () => {},
      abort: () => {},
      end: () => {},
    }),
  },
}))

vi.mock('../main/presets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../main/presets')>()
  return {
    ...actual,
    activePreset: () => ({ name: '默认预设', model: 'gpt-image-2' }),
  }
})

import { resolvePrompt } from './lib/refTokens'
import { resolveSkillPrompt, missingSkillNames, displayPrompt } from './lib/skillTokens'
import { mentionizeMarkup, htmlToText } from './components/PromptEditor'
import type { RefImage, Skill, HistoryEntry } from '../shared/types'
import { normalizeResponse } from '../main/normalize'

describe('End-to-End Workflow Verification: RefImages, Skills, Mentions & Generation', () => {
  const fakeRef1: RefImage = {
    id: 'ref-1',
    index: 1,
    name: 'cup.jpg',
    mime: 'image/jpeg',
    dataUrl: 'data:image/jpeg;base64,fakejpgdata',
    width: 512,
    height: 512,
    bytes: 1024,
  }

  const fakeRef2: RefImage = {
    id: 'ref-2',
    index: 2,
    name: 'mountain.png',
    mime: 'image/png',
    dataUrl: 'data:image/png;base64,fakepngdata',
    width: 1024,
    height: 1024,
    bytes: 2048,
  }

  const testSkill: Skill = {
    id: 'skill-1',
    name: '极简商业',
    content: '极简构图，柔和侧光，纯白背景，大师级细节。',
    sourceName: 'minimal.md',
    charCount: 22,
    createdAt: Date.now(),
  }

  describe('1. Reference Image @ Mentions resolution', () => {
    it('resolves @图1 and @图2 correctly into prompt and image links', () => {
      const prompt = '杯子 ⟦skill:极简商业⟧ @图1'
      const res = resolvePrompt(prompt, [fakeRef1, fakeRef2])
      expect(res.errors).toHaveLength(0)
      expect(res.text).toBe('杯子 ⟦skill:极简商业⟧ 第1张参考图')
      expect(res.referenced).toHaveLength(1)
      expect(res.referenced[0]).toBe(1)
    })

    it('reports error when referenced index is out of bounds', () => {
      const prompt = '测试未上传的参考图 @图3'
      const res = resolvePrompt(prompt, [fakeRef1])
      expect(res.errors.length).toBeGreaterThan(0)
      expect(res.errors[0]).toContain('@图3')
    })
  })

  describe('2. Skills Expansion & Validation', () => {
    it('expands skill tokens in prompt into full content', () => {
      const raw = '主体轿车 ⟦skill:极简商业⟧'
      const res = resolveSkillPrompt(raw, [testSkill])
      expect(res.errors).toHaveLength(0)
      expect(res.text).toContain('极简构图，柔和侧光')
      expect(res.referenced).toHaveLength(1)
      expect(res.referenced[0]).toBe('极简商业')
    })

    it('deduplicates multiple invocations of the same skill', () => {
      const raw = '⟦skill:极简商业⟧ 正文 ⟦skill:极简商业⟧'
      const res = resolveSkillPrompt(raw, [testSkill])
      expect(res.referenced).toHaveLength(1)
    })

    it('detects missing/deleted skills and flags errors', () => {
      const raw = '测试 ⟦skill:已删除Skill⟧'
      const missing = missingSkillNames(raw, [testSkill])
      expect(missing).toHaveLength(1)
      expect(missing).toContain('已删除Skill')

      const res = resolveSkillPrompt(raw, [testSkill])
      expect(res.errors.length).toBeGreaterThan(0)
    })

    it('formats display prompt for History without leaking raw tokens', () => {
      const raw = '车展 ⟦skill:极简商业⟧ @图1'
      const display = displayPrompt(raw)
      expect(display).toBe('车展 ◆ 极简商业 @图1')
    })
  })

  describe('3. Markup and HTML roundtrip for Editor with Atomic Capsules', () => {
    it('converts raw text with skills and @ mentions into atomic markup and back to canonical text', () => {
      const raw = '产品图 ⟦skill:极简商业⟧ @图1'
      const markup = mentionizeMarkup(raw)
      expect(markup).toContain('class="skill-chip"')
      expect(markup).toContain('contenteditable="false"')
      expect(markup).toContain('class="mention"')
      expect(markup).toContain('data-skill="极简商业"')
      expect(markup).toContain('data-mention="1"')

      const restored = htmlToText(markup)
      expect(restored).toBe(raw)
    })
  })

  describe('4. Response Normalization & img:// Protocol generation', () => {
    it('normalizes base64 response, persists files and generates img:// URLs with snapshot', async () => {
      const req = {
        requestId: 'req-e2e-1',
        promptRaw: '画一只猫 ⟦skill:极简商业⟧ @图1',
        promptResolved: '画一只猫 纯白背景',
        params: { aspect: '1:1' as const, resolution: '1K' as const, quality: 'high' as const, count: 1 as const },
        images: ['base64imgdata'],
        refImages: [fakeRef1],
      }
      const rawApiResp = {
        data: [{ b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNiAAAABgADNjd8qAAAAABJRU5ErkJggg==' }],
      }

      const res = await normalizeResponse(req, rawApiResp)
      expect(res.ok).toBe(true)
      if (res.ok) {
        expect(res.entry.images).toHaveLength(1)
        expect(res.entry.images[0]?.url).toMatch(/^img:\/\/req-e2e-1-0\.png$/)
        expect(res.entry.refImages).toHaveLength(1)
        expect(res.entry.refImages?.[0]?.name).toBe('cup.jpg')
      }
    })
  })

  describe('5. History Refill Roundtrip', () => {
    it('restores prompt, params, and reference images from history entry', () => {
      const entry: HistoryEntry = {
        id: 'hist-1',
        createdAt: Date.now(),
        model: 'gpt-image-2',
        presetName: '默认预设',
        promptRaw: '商业摄影 ⟦skill:极简商业⟧ @图1',
        promptResolved: '商业摄影 极简构图，柔和侧光，纯白背景，大师级细节。',
        params: { aspect: '16:9', resolution: '2K', quality: 'high', count: 2 },
        size: '2048x1152',
        refImageFiles: [],
        refImages: [fakeRef1, fakeRef2],
        images: [{ file: 'req-1-0.png', url: 'img://req-1-0.png' }],
      }

      const restoredPrompt = entry.promptRaw
      const restoredAspect = entry.params.aspect
      const restoredResolution = entry.params.resolution
      const restoredQuality = entry.params.quality
      const restoredRefs = entry.refImages?.map((r, i) => ({ ...r, index: i + 1 }))

      expect(restoredPrompt).toBe('商业摄影 ⟦skill:极简商业⟧ @图1')
      expect(restoredAspect).toBe('16:9')
      expect(restoredResolution).toBe('2K')
      expect(restoredQuality).toBe('high')
      expect(restoredRefs).toHaveLength(2)
      expect(restoredRefs?.[0]?.index).toBe(1)
      expect(restoredRefs?.[1]?.index).toBe(2)
    })
  })
})
