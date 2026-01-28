import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { POST } from '@/app/api/membros/[id]/anamnese-link/route'

const { prismaMock, sessionRef, randomBytesMock } = vi.hoisted(() => ({
  prismaMock: {
    membro: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  sessionRef: {
    current: { user: { role: 'ADMIN' as const } },
  } as { current: { user: { role: 'ADMIN' | 'MEMBRO' } } },
  randomBytesMock: vi.fn(),
}))

vi.mock('crypto', () => ({
  randomBytes: randomBytesMock,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/api', () => ({
  withApiAuth: vi.fn(
    async (
      handler: (session: typeof sessionRef.current) => Promise<NextResponse>,
      options?: { requiredRole?: 'ADMIN' | 'MEMBRO'; requireAuth?: boolean }
    ) => {
      if (options?.requiredRole && sessionRef.current.user.role !== options.requiredRole) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
      }
      return handler(sessionRef.current)
    }
  ),
}))

describe('Membros Anamnese Link API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionRef.current = { user: { role: 'ADMIN' } }
  })

  const params = (id: string) => ({ params: Promise.resolve({ id }) })

  it('returns 404 when membro not found', async () => {
    prismaMock.membro.findUnique.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost:3000/api/membros/m-1/anamnese-link', {
      method: 'POST',
    })
    const res = await POST(req, params('m-1'))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toContain('Membro não encontrado')
  })

  it('generates link and updates token', async () => {
    prismaMock.membro.findUnique.mockResolvedValueOnce({ id: 'm-1' })
    randomBytesMock.mockReturnValueOnce(Buffer.from('token-hex'))

    const req = new NextRequest('http://localhost:3000/api/membros/m-1/anamnese-link', {
      method: 'POST',
    })
    const res = await POST(req, params('m-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.membro.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm-1' },
        data: expect.objectContaining({
          anamneseToken: '746f6b656e2d686578',
        }),
      })
    )
    expect(json.link).toContain('/anamnese?token=')
    expect(json.expiresAt).toBeTruthy()
  })
})
