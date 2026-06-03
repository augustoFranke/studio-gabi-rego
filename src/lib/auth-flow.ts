import { randomBytes } from 'node:crypto'
import {
  getAppBaseUrlConfig,
  getAuthSecretConfig,
} from '@/lib/runtime-config'

const DEFAULT_TOKEN_EXPIRY_MS = 60 * 60 * 1000

export type TimedToken = {
  token: string
  expiresAt: Date
}

export function createTimedToken(ttlMs = DEFAULT_TOKEN_EXPIRY_MS): TimedToken {
  return {
    token: randomBytes(32).toString('hex'),
    expiresAt: new Date(Date.now() + ttlMs),
  }
}

function getTokenSecret() {
  return getAuthSecretConfig() || 'development-token-secret'
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashTimedToken(token: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(getTokenSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(token))
  return toHex(signature)
}

export async function getTimedTokenLookup(token: string) {
  return {
    rawToken: token,
    hashedToken: await hashTimedToken(token),
  }
}

export function getAppBaseUrl(origin?: string): string {
  return getAppBaseUrlConfig(origin)
}
