import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ available: true, store: new Map<string, string>() }))

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/vitest-secret-userdata' },
  safeStorage: {
    isEncryptionAvailable: () => mocks.available,
    // 用可逆的 base64 代替系统钥匙串（单测里不需要真的钥匙串，只验证调用链）
    encryptString: (s: string) => {
      const enc = Buffer.from(s, 'utf-8').toString('base64')
      mocks.store.set(enc, s)
      return Buffer.from(enc, 'utf-8')
    },
    decryptString: (buf: Buffer) => mocks.store.get(buf.toString('utf-8')) ?? '',
  },
}))

import { encryptApiKey, decryptApiKey, isEncryptedApiKey, APIKEY_ENC_PREFIX } from './secret'
import { isSafeImageFilename } from './history'

describe('secret.ts — API Key 落盘加密', () => {
  it('空 Key 原样返回', () => {
    expect(encryptApiKey('')).toBe('')
    expect(decryptApiKey('')).toBe('')
  })

  it('明文加密后带 enc: 前缀，且盘上不含明文', () => {
    const enc = encryptApiKey('sk-plaintext-1234567890')
    expect(enc.startsWith(APIKEY_ENC_PREFIX)).toBe(true)
    expect(enc).not.toContain('sk-plaintext')
    expect(isEncryptedApiKey(enc)).toBe(true)
  })

  it('解密还原明文', () => {
    const enc = encryptApiKey('sk-roundtrip-abcdef')
    expect(decryptApiKey(enc)).toBe('sk-roundtrip-abcdef')
  })

  it('幂等：已加密串不会被二次加密', () => {
    const once = encryptApiKey('sk-idempotent')
    expect(encryptApiKey(once)).toBe(once)
    expect(decryptApiKey(encryptApiKey(once))).toBe('sk-idempotent')
  })

  it('旧明文盘平滑升级：未带前缀的明文 decrypt 原样返回', () => {
    expect(isEncryptedApiKey('sk-legacy-plain')).toBe(false)
    expect(decryptApiKey('sk-legacy-plain')).toBe('sk-legacy-plain')
  })

  it('加密不可用时回落明文（不丢 Key）', () => {
    mocks.available = false
    expect(encryptApiKey('sk-no-keychain')).toBe('sk-no-keychain')
    mocks.available = true
  })

  it('损坏的密文解密返回空串而不是抛错', () => {
    expect(decryptApiKey('enc:not-valid-base64!!')).toBe('')
  })
})

describe('history.ts — 下载文件名白名单（防路径穿越）', () => {
  it('合法 png 文件名通过', () => {
    expect(isSafeImageFilename('image.png')).toBe(true)
    expect(isSafeImageFilename('gen_2026-11-12.a.b.png')).toBe(true)
    expect(isSafeImageFilename('A-1_2.png')).toBe(true)
  })

  it('拒绝路径穿越与分隔符', () => {
    expect(isSafeImageFilename('../secret.png')).toBe(false)
    expect(isSafeImageFilename('..%2fsecret.png')).toBe(false)
    expect(isSafeImageFilename('sub/dir/x.png')).toBe(false)
    expect(isSafeImageFilename('sub\\x.png')).toBe(false)
    expect(isSafeImageFilename('/etc/passwd.png')).toBe(false)
  })

  it('拒绝非 png / 空 / 超长 / 非字符串', () => {
    expect(isSafeImageFilename('photo.jpg')).toBe(false)
    expect(isSafeImageFilename('image.png.exe')).toBe(false)
    expect(isSafeImageFilename('')).toBe(false)
    expect(isSafeImageFilename('x'.repeat(300) + '.png')).toBe(false)
    expect(isSafeImageFilename(null)).toBe(false)
    expect(isSafeImageFilename(undefined)).toBe(false)
    expect(isSafeImageFilename(42)).toBe(false)
    expect(isSafeImageFilename({})).toBe(false)
  })

  it('拒绝含 .. 的任意位置', () => {
    expect(isSafeImageFilename('a..b.png')).toBe(false)
    expect(isSafeImageFilename('..png')).toBe(false)
  })
})
