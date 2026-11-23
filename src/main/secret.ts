import { safeStorage } from 'electron'

export const APIKEY_ENC_PREFIX = 'enc:'

export function isEncryptedApiKey(v: unknown): boolean {
  return typeof v === 'string' && (v as string).startsWith(APIKEY_ENC_PREFIX)
}

export function encryptApiKey(plain: string): string {
  if (!plain) return ''
  if (isEncryptedApiKey(plain)) return plain as string
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buf = safeStorage.encryptString(plain)
      return APIKEY_ENC_PREFIX + buf.toString('base64')
    }
  } catch {
    // 加密失败则回落，调用方仍会 chmod 600；macOS 下通常可用
  }
  return plain
}

export function decryptApiKey(stored: string): string {
  if (!stored) return ''
  if (!isEncryptedApiKey(stored)) return stored
  const b64 = (stored as string).slice(APIKEY_ENC_PREFIX.length)
  try {
    const buf = Buffer.from(b64, 'base64')
    return safeStorage.decryptString(buf)
  } catch {
    return ''
  }
}
