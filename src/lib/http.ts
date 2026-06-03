type ErrorResponseBody = {
  error?: unknown
}

const DEFAULT_FETCH_TIMEOUT_MS = 15_000

export const LONG_RUNNING_FETCH_TIMEOUT_MS = 30_000

export type FetchWithTimeoutInit = RequestInit & {
  timeoutMs?: number
}

export type FetchJsonInit = FetchWithTimeoutInit & {
  json?: unknown
}

export class FetchTimeoutError extends Error {
  timeoutMs: number

  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`)
    this.name = 'FetchTimeoutError'
    this.timeoutMs = timeoutMs
  }
}

function isErrorResponseBody(value: unknown): value is ErrorResponseBody {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && 'error' in value
}

function makeRequestHeaders(headers: HeadersInit | undefined, hasJsonBody: boolean): Headers {
  const requestHeaders = new Headers(headers)
  if (!requestHeaders.has('Accept')) {
    requestHeaders.set('Accept', 'application/json')
  }
  if (hasJsonBody && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json')
  }

  return requestHeaders
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: FetchWithTimeoutInit = {}
): Promise<Response> {
  const {
    timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
    signal,
    ...requestInit
  } = init

  if (timeoutMs <= 0) {
    return fetch(input, { ...requestInit, signal })
  }

  const controller = new AbortController()
  let timedOut = false
  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  const abortFromCaller = () => controller.abort(signal?.reason)
  if (signal?.aborted) {
    abortFromCaller()
  } else {
    signal?.addEventListener('abort', abortFromCaller, { once: true })
  }

  try {
    return await fetch(input, {
      ...requestInit,
      signal: controller.signal,
    })
  } catch (error) {
    if (timedOut) {
      throw new FetchTimeoutError(timeoutMs)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', abortFromCaller)
  }
}

export async function readResponseErrorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  const bodyText = await response.text()
  if (!bodyText.trim()) {
    return fallback
  }

  try {
    const body: unknown = JSON.parse(bodyText)
    if (isErrorResponseBody(body) && typeof body.error === 'string' && body.error.trim()) {
      return body.error
    }
  } catch {
    // Fall back to the caller-provided message when the body is not JSON.
  }

  return fallback
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init: FetchJsonInit = {},
  fallbackErrorMessage = 'Erro ao carregar dados'
): Promise<T> {
  const { json, body, headers, ...requestInit } = init
  const hasJsonBody = json !== undefined
  const response = await fetchWithTimeout(input, {
    ...requestInit,
    headers: makeRequestHeaders(headers, hasJsonBody),
    body: hasJsonBody ? JSON.stringify(json) : body,
  })

  if (!response.ok) {
    throw new Error(await readResponseErrorMessage(response, fallbackErrorMessage))
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
