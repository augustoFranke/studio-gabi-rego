/**
 * Structured JSON logger for operational events.
 *
 * Emits one JSON object per line to stdout/stderr so Vercel Runtime Logs (and
 * any future log drain) can index, search, and alert on stable fields:
 *
 *   timestamp, level, event, correlationId, source, route, ...metadata
 *
 * Redaction
 * ---------
 * The logger strips values for keys that look like secrets before emitting.
 * Callers should still avoid passing raw credentials, but the safety net
 * catches accidental leaks from error objects and provider responses.
 *
 * Test runtime
 * ------------
 * When `NODE_ENV=test` or Vitest is detected the logger is silent by default.
 * This matches the test-runtime suppression behavior.
 *
 * @module observability/logger
 */

import { getExecutionContext } from './request-context'
import type { OperationalEvent } from './events'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogPayload {
  timestamp: string
  level: LogLevel
  event: string
  correlationId: string | null
  source: string | null
  route: string | null
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

/**
 * Keys whose values should be replaced with `[REDACTED]` before emission.
 * Case-insensitive partial matching so nested error objects are also caught.
 */
const SENSITIVE_KEY_PATTERNS = [
  'secret',
  'password',
  'token',
  'authorization',
  'apikey',
  'api_key',
  'bearer',
  'credential',
  'cookie',
  'session',
]

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase()
  return SENSITIVE_KEY_PATTERNS.some((p) => lower.includes(p))
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function redactValue(value: unknown): unknown {
  if (isPlainObject(value)) {
    return redact(value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item))
  }

  return value
}

/**
 * Deep-clone `data` while replacing sensitive values with `[REDACTED]`.
 * Handles plain objects and arrays; other types pass through as-is.
 */
function redact(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveKey(key)) {
      out[key] = '[REDACTED]'
    } else {
      out[key] = redactValue(value)
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Test-runtime detection
// ---------------------------------------------------------------------------

function isTestRuntime(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST === 'true' ||
    process.argv.some((arg) => arg.includes('vitest'))
  )
}

// ---------------------------------------------------------------------------
// Core logger
// ---------------------------------------------------------------------------

/**
 * Emit a structured operational event.
 *
 * @param level  - `'info'` | `'warn'` | `'error'`
 * @param event  - A stable event name from `observability/events` (or any string during migration)
 * @param data   - Free-form metadata attached to the log line. Sensitive keys are redacted automatically.
 */
export function logEvent(
  level: LogLevel,
  event: OperationalEvent | string,
  data: Record<string, unknown> = {},
): void {
  if (isTestRuntime()) return

  const ctx = getExecutionContext()
  const payload: LogPayload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    correlationId: ctx?.correlationId ?? null,
    source: ctx?.source ?? null,
    route: ctx?.route ?? null,
    ...redact(data),
  }

  const line = JSON.stringify(payload)

  switch (level) {
    case 'error':
      console.error(line)
      break
    case 'warn':
      console.warn(line)
      break
    default:
      console.log(line)
  }
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

export function logInfo(event: OperationalEvent | string, data?: Record<string, unknown>): void {
  logEvent('info', event, data)
}

export function logWarn(event: OperationalEvent | string, data?: Record<string, unknown>): void {
  logEvent('warn', event, data)
}

export function logError(event: OperationalEvent | string, data?: Record<string, unknown>): void {
  logEvent('error', event, data)
}

/**
 * Safely extract a loggable error representation.
 * Never logs raw stack traces in production.
 */
export function safeErrorData(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      ...(process.env.NODE_ENV !== 'production' ? { stack: error.stack } : {}),
    }
  }
  return { errorMessage: String(error) }
}
