import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/auth/verificar-email/route'

const { prismaMock, cryptoMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  cryptoMock: {
    randomBytes: vi.fn(() => Buffer.from('d'.repeat(32))),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('crypto', () => cryptoMock)

describe('Auth API - POST /api/auth/verificar-email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const post = (body: Record<string, unknown>) =>
    POST(
      new Request('http://localhost:3000/api/auth/verificar-email', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    )

  it('returns 400 when token is missing', async () => {
    const res = await post({})
    expect(res.status).toBe(400)
  })

  it('returns 400 when token is invalid', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null)

    const res = await post({ token: 'invalid' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when token is expired', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: 'u-1',
      tokenVerificacaoExpira: new Date(Date.now() - 60_000),
    })

    const res = await post({ token: 'expired' })
    expect(res.status).toBe(400)
  })

  it('marks email as verified and returns profile token when token is valid', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: 'u-1',
      tokenVerificacaoExpira: new Date(Date.now() + 60_000),
    })

    const res = await post({ token: 'ok' })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.usuario.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: expect.objectContaining({
        emailVerificado: expect.any(Date),
        tokenVerificacao: null,
        tokenVerificacaoExpira: null,
        tokenReset: expect.any(String),
        tokenResetExpira: expect.any(Date),
        etapaOnboarding: 2,
      }),
    })
    expect(json.success).toBe(true)
    expect(json.profileToken).toBeTypeOf('string')
    expect(json.isAdmin).toBe(false)
  })
})
