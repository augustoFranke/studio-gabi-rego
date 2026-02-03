import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/health/route'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}))

vi.mock('@/lib/api', () => ({
  withApiAuth: vi.fn(
    async (handler: (_session: { user: { role: 'ADMIN'; id: string } }) => Promise<NextResponse>) =>
      handler({ user: { role: 'ADMIN', id: 'u-1' } })
  ),
}))

describe('Health API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns healthy when database responds', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([])

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('healthy')
    expect(json.services.database).toBe('connected')
  })

  it('returns unhealthy when database fails', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('DB down'))

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(503)
    expect(json.status).toBe('unhealthy')
    expect(json.services.database).toBe('disconnected')
    expect(json.error).toContain('DB down')
  })
})
