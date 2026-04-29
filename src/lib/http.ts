import { safeJsonParse } from '@/lib/safe-json'

type ErrorResponseBody = {
  error?: unknown
}

function isErrorResponseBody(value: unknown): value is ErrorResponseBody {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && 'error' in value
}

export async function readResponseErrorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  const bodyText = await response.text()
  if (!bodyText.trim()) {
    return fallback
  }

  const parsedBody = safeJsonParse(bodyText)
  if (parsedBody.ok) {
    if (
      isErrorResponseBody(parsedBody.data) &&
      typeof parsedBody.data.error === 'string' &&
      parsedBody.data.error.trim()
    ) {
      return parsedBody.data.error
    }
  }

  return fallback
}

export async function readOptionalJsonBody(request: Request): Promise<
  { ok: true; body: unknown } | { ok: false }
> {
  const bodyText = await request.text()
  if (!bodyText.trim()) {
    return { ok: true, body: {} }
  }

  const parsedBody = safeJsonParse(bodyText)
  if (!parsedBody.ok) {
    return { ok: false }
  }

  return { ok: true, body: parsedBody.data }
}
