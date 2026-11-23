import { describe, expect, it } from 'vitest'
import {
  chipTextFor,
  findActiveQueryPure,
  longToShortOffset,
  normalizeRefTokens,
  shortToLongCaret,
  skillTokenFor,
} from '../PromptEditor'

describe('skill + @ token-aware (P0-1)', () => {
  it('skill 后有空格再输入 @ 能准确定位 fresh @', () => {
    const token = skillTokenFor('极简商业')
    const plain = `${token} @`
    // 在真实 DOM 中，span 内部文本即 '极简商业' (4 chars)，后跟 ' @' (2 chars)
    // 插入 @ 后的 DOM 光标位置是 4 + 2 = 6
    const chipLen = chipTextFor('极简商业').length
    const mapped = shortToLongCaret(plain, chipLen + 2)
    expect(mapped).toBe(plain.length) // 14
    const q = findActiveQueryPure(plain, mapped)
    expect(q.atStart).toBe(plain.length - 1) // 13 ('@' 的索引)
    expect(q.query).toBe('')
    // 逆向 DOM 映射：长文本中的 @ (index 13) 换算回 DOM 短偏移量应为 5 (' @' 中的 @)
    expect(longToShortOffset(plain, 13)).toBe(5)
  })

  it('skill 后紧贴输入 @ (无空格) 也能准确定位 fresh @', () => {
    const token = skillTokenFor('极简商业')
    const plain = `${token}@`
    // 在真实 DOM 中为 '极简商业@' (5 chars)，光标在 5
    const chipLen = chipTextFor('极简商业').length
    const mapped = shortToLongCaret(plain, chipLen + 1)
    expect(mapped).toBe(plain.length) // 13
    const q = findActiveQueryPure(plain, mapped)
    expect(q.atStart).toBe(plain.length - 1) // 12
    expect(q.query).toBe('')
    expect(longToShortOffset(plain, 12)).toBe(4)
  })

  it('前置正文 + skill 后输入 @ 依然准确定位', () => {
    const token = skillTokenFor('极简商业')
    const plain = `车展 ${token} @`
    // DOM: '车展 极简商业 @' (3 + 4 + 2 = 9)
    const mapped = shortToLongCaret(plain, 9)
    expect(mapped).toBe(plain.length)
    const q = findActiveQueryPure(plain, mapped)
    expect(q.atStart).toBe(plain.length - 1)
    expect(q.query).toBe('')
    expect(longToShortOffset(plain, q.atStart)).toBe(8)
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
