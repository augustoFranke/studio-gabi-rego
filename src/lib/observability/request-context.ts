/**
 * Request/run execution context using AsyncLocalStorage.
 *
 * Seeds a stable correlation ID at every server entry point (API routes, cron
 * jobs, server actions) so downstream logs, provider calls, and retries can be
 * grouped without manually threading identifiers.
 *
 * @module observability/request-context
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExecutionSource = 'request' | 'cron' | 'server_action'

export interface ExecutionContext {
  /** App-owned correlation identifier (UUID v4). */
  correlationId: string
  /** Where the execution originated. */
  source: ExecutionSource
  /** Route path or server-action name. */
  route: string
  /** Optional authenticated user / actor identifier. */
  actorId?: string
  /** Cron job name when source is 'cron'. */
  jobName?: string
  /** Vercel execution ID from x-vercel-id header, if available. */
  vercelId?: string
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const storage = new AsyncLocalStorage<ExecutionContext>()

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run `fn` inside an execution context. If no `correlationId` is supplied one
 * is generated. All observability helpers called inside `fn` will automatically
 * pick up the context.
 */
export function runWithExecutionContext<T>(
  ctx: Omit<ExecutionContext, 'correlationId'> & { correlationId?: string },
  fn: () => T,
): T {
  return storage.run(
    { ...ctx, correlationId: ctx.correlationId ?? randomUUID() },
    fn,
  )
}

/**
 * Read the current execution context, or `undefined` when called outside of
 * `runWithExecutionContext`.
 */
export function getExecutionContext(): ExecutionContext | undefined {
  return storage.getStore()
}
