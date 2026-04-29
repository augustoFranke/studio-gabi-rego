import { randomBytes } from 'node:crypto'

const DEFAULT_TOKEN_EXPIRY_MS = 60 * 60 * 1000
const DEFAULT_APP_BASE_URL = 'https://studiogabirego.com'

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
  return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'development-token-secret'
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

function normalizeBaseUrl(value?: string | null) {
  if (!value) return null

  try {
    const url = new URL(value)
    return url.origin
  } catch {
    return null
  }
}

export function getAppBaseUrl(origin?: string): string {
  const configuredUrl =
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeBaseUrl(process.env.NEXTAUTH_URL) ||
    normalizeBaseUrl(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)

  if (configuredUrl) return configuredUrl

  if (process.env.NODE_ENV !== 'production') {
    return normalizeBaseUrl(origin) || DEFAULT_APP_BASE_URL
  }

  return DEFAULT_APP_BASE_URL
}
