/**
 * Legacy runtime-log compatibility shim.
 *
 * Existing callers continue to use `runtimeError` and `runtimeWarn` without
 * changes. Internally both now delegate to the shared structured logger so
 * operational events are consistent and redaction/correlation are applied.
 *
 * Test-runtime suppression is preserved — the structured logger already
 * silences itself when Vitest or NODE_ENV=test is detected.
 *
 * @module runtime-log
 */

import { logEvent, safeErrorData } from '@/lib/observability/logger'

export function runtimeError(message: string, error: unknown): void {
  logEvent('error', 'runtime_error', {
    message,
    ...safeErrorData(error),
  })
}

export function runtimeWarn(message: string): void {
  logEvent('warn', 'runtime_warning', { message })
}
