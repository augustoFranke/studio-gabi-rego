import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api'
import { auth } from '@/lib/auth'
import { AUTH_SESSION_ERROR } from '@/lib/observability/events'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

const { logErrorMock } = vi.hoisted(() => ({
  logErrorMock: vi.fn(),
}))

vi.mock('@/lib/observability/logger', () => ({
  logError: logErrorMock,
}))

describe('withApiAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when auth is required and no session exists', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const res = await withApiAuth(async () => NextResponse.json({ ok: true }))

    expect(res.status).toBe(401)
  })

  it('returns 403 when role does not match', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MEMBRO' } })

    const res = await withApiAuth(async () => NextResponse.json({ ok: true }), {
      requiredRole: 'ADMIN',
    })

    expect(res.status).toBe(403)
  })

  it('calls handler when auth and role checks pass', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })

    const res = await withApiAuth(async (session) =>
      NextResponse.json({ ok: session.user.role })
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: 'ADMIN' })
  })

  it('returns 500 when auth returns a malformed session shape', async () => {
    vi.mocked(auth).mockResolvedValue(
      { user: { id: 'u1' } } as unknown as Awaited<ReturnType<typeof auth>>
    )

    const handler = vi.fn(async () => NextResponse.json({ ok: true }))
    const res = await withApiAuth(handler)

    expect(res.status).toBe(500)
    expect(handler).not.toHaveBeenCalled()
    expect(logErrorMock).toHaveBeenCalledWith(
      AUTH_SESSION_ERROR,
      expect.objectContaining({ reason: 'invalid_session_shape' })
    )
  })
})
