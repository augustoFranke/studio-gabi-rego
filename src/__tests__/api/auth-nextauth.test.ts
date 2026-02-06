import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST, runtime } from '@/app/api/auth/[...nextauth]/route'

const { handlersMock, rateLimitMock } = vi.hoisted(() => ({
  handlersMock: {
    GET: vi.fn(async () => Response.json({ ok: 'get' })),
    POST: vi.fn(async () => Response.json({ ok: 'post' })),
  },
  rateLimitMock: vi.fn(async () => ({ success: true })),
}))

vi.mock('@/lib/auth', () => ({
  handlers: handlersMock,
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimitByIp: rateLimitMock,
}))

describe('Auth API - /api/auth/[...nextauth]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimitMock.mockResolvedValue({ success: true })
  })

  it('exports nodejs runtime', () => {
    expect(runtime).toBe('nodejs')
  })

  it('delegates GET directly to handlers.GET', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/session')
    await GET(req)
    expect(handlersMock.GET).toHaveBeenCalledWith(req)
  })

  it('returns 429 for credentials callback when rate limit fails', async () => {
    rateLimitMock.mockResolvedValue({ success: false })
    const req = new NextRequest('http://localhost:3000/api/auth/callback/credentials', {
      method: 'POST',
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error).toContain('Muitas tentativas')
    expect(handlersMock.POST).not.toHaveBeenCalled()
  })

  it('delegates POST to handlers when not credentials callback', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/signin', {
      method: 'POST',
    })

    await POST(req)
    expect(handlersMock.POST).toHaveBeenCalledWith(req)
  })
})
