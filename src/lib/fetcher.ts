/**
 * SWR fetcher utility for client-side data fetching
 * Provides consistent error handling and response parsing
 */

export class FetchError extends Error {
  status: number
  info: unknown

  constructor(message: string, status: number, info?: unknown) {
    super(message)
    this.name = 'FetchError'
    this.status = status
    this.info = info
  }
}

export const fetcher = async <T = unknown>(url: string): Promise<T> => {
  const res = await fetch(url)

  if (!res.ok) {
    let info: unknown
    try {
      info = await res.json()
    } catch {
      info = await res.text()
    }
    throw new FetchError('API Error', res.status, info)
  }

  return res.json()
}
