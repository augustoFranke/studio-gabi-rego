import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api'
import { auth } from '@/lib/auth'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
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
})
