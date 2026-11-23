import { describe, expect, it } from 'vitest'
import { chipTextFor, findActiveQueryPure, normalizeRefTokens, shortToLongCaret, skillTokenFor } from '../PromptEditor'

describe('skill + @ token-aware (P0-1)', () => {
  it('skill 后 @ 能定位 fresh @', () => {
    const token = skillTokenFor('修图')
    const plain = `${token} @`
    const chipLen = chipTextFor('修图').length
    const mapped = shortToLongCaret(plain, chipLen + 2)
    expect(mapped).toBe(plain.length)
    const q = findActiveQueryPure(plain, mapped)
    expect(q.atStart).toBe(plain.length - 1)
  })
  it('skill 前 @ 也能定位', () => {
    const token = skillTokenFor('修图')
    const plain = `@${token}`
    const q = findActiveQueryPure(plain, shortToLongCaret(plain, 1))
    expect(q.atStart).toBe(0)
  })
  it('@@ 压成单个 @', () => {
    expect(normalizeRefTokens('@@')).toBe('@')
    expect(normalizeRefTokens('a@@b')).toBe('a@b')
  })
})
