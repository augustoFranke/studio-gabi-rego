import { randomBytes } from 'crypto'

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

export function getAppBaseUrl(origin?: string): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : origin) ||
    DEFAULT_APP_BASE_URL
  )
}
