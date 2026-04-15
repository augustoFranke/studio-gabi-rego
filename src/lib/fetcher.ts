/**
 * SWR fetcher utility for client-side data fetching
 * Provides consistent error handling and response parsing
 */

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | { [key: string]: JsonValue } | JsonValue[]

export class FetchError extends Error {
  status: number
  info: string | JsonValue | undefined

  constructor(message: string, status: number, info?: string | JsonValue) {
    super(message)
    this.name = 'FetchError'
    this.status = status
    this.info = info
  }
}

export const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url)

  if (!res.ok) {
    let info: string | JsonValue
    try {
      info = (await res.json()) as JsonValue
    } catch {
      info = await res.text()
    }
    throw new FetchError('API Error', res.status, info)
  }

  return (await res.json()) as T
}
