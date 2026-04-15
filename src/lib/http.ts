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
