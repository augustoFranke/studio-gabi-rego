import { timingSafeEqual } from 'node:crypto'
import { NextRequest } from 'next/server'
import { logWarn } from '@/lib/observability/logger'
import { CRON_AUTH_FAILED } from '@/lib/observability/events'

export type CronAuthFailureReason =
  | 'missing_secret'
  | 'missing_authorization_header'
  | 'malformed_authorization_header'
  | 'missing_bearer_token'
  | 'invalid_token'

export type CronAuthResult =
  | { ok: true }
  | { ok: false; reason: CronAuthFailureReason }

function logCronAuthFailure(path: string, reason: CronAuthFailureReason) {
  logWarn(CRON_AUTH_FAILED, { path, reason })
}

function extractBearerToken(authorizationHeader: string | null):
  | { ok: true; token: string }
  | { ok: false; reason: Exclude<CronAuthFailureReason, 'missing_secret' | 'invalid_token'> } {
  if (!authorizationHeader) {
    return { ok: false, reason: 'missing_authorization_header' }
  }

  if (!authorizationHeader.startsWith('Bearer ')) {
    return { ok: false, reason: 'malformed_authorization_header' }
  }

  const token = authorizationHeader.slice(7).trim()
  if (!token) {
    return { ok: false, reason: 'missing_bearer_token' }
  }

  return { ok: true, token }
}

function isTokenValid(token: string, secret: string) {
  const tokenBuffer = Buffer.from(token, 'utf8')
  const secretBuffer = Buffer.from(secret, 'utf8')

  if (tokenBuffer.length !== secretBuffer.length) {
    return false
  }

  return timingSafeEqual(tokenBuffer, secretBuffer)
}

export function validateCronRequest(request: NextRequest, secret: string | undefined): CronAuthResult {
  if (!secret) {
    logCronAuthFailure(request.nextUrl.pathname, 'missing_secret')
    return { ok: false, reason: 'missing_secret' }
  }

  const extracted = extractBearerToken(request.headers.get('authorization'))
  if (!extracted.ok) {
    logCronAuthFailure(request.nextUrl.pathname, extracted.reason)
    return { ok: false, reason: extracted.reason }
  }

  if (!isTokenValid(extracted.token, secret)) {
    logCronAuthFailure(request.nextUrl.pathname, 'invalid_token')
    return { ok: false, reason: 'invalid_token' }
  }

  return { ok: true }
}
