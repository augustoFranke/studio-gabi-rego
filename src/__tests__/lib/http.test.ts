import { afterEach, describe, expect, it, vi } from 'vitest'
import { FetchTimeoutError, fetchJson, fetchWithTimeout } from '@/lib/http'

describe('http helpers', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    global.fetch = originalFetch
  })

  it('fetchWithTimeout passes an abort signal to fetch', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('{}')) as unknown as typeof fetch

    await fetchWithTimeout('/api/test')

    const init = vi.mocked(global.fetch).mock.calls[0][1] as RequestInit
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('fetchWithTimeout rejects with FetchTimeoutError when the request hangs', async () => {
    vi.useFakeTimers()
    global.fetch = vi.fn((_input, init) => {
      const signal = (init as RequestInit).signal
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        })
      })
    }) as unknown as typeof fetch

    const request = expect(fetchWithTimeout('/api/slow', { timeoutMs: 50 }))
      .rejects
      .toBeInstanceOf(FetchTimeoutError)
    await vi.advanceTimersByTimeAsync(50)

    await request
  })

  it('fetchJson serializes JSON bodies and parses successful responses', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    ) as unknown as typeof fetch

    await expect(
      fetchJson<{ ok: boolean }>('/api/test', {
        method: 'POST',
        json: { value: 1 },
      })
    ).resolves.toEqual({ ok: true })

    const init = vi.mocked(global.fetch).mock.calls[0][1] as RequestInit
    expect((init.headers as Headers).get('Content-Type')).toBe('application/json')
    expect((init.headers as Headers).get('Accept')).toBe('application/json')
    expect(init.body).toBe(JSON.stringify({ value: 1 }))
  })

  it('fetchJson throws the API error message when a request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Mensagem da API' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    ) as unknown as typeof fetch

    await expect(fetchJson('/api/test')).rejects.toThrow('Mensagem da API')
  })
})
