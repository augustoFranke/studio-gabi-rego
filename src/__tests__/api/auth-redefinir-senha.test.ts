import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/auth/redefinir-senha/route'

const { prismaMock, bcryptMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  bcryptMock: {
    hash: vi.fn(async (senha: string) => `hashed_${senha}`),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('bcryptjs', () => bcryptMock)

describe('Auth API - POST /api/auth/redefinir-senha', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const post = (body: Record<string, unknown>) =>
    POST(
      new Request('http://localhost:3000/api/auth/redefinir-senha', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    )

  it('returns 400 when token or senha are missing', async () => {
    const res = await post({ token: 't-1' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is too short', async () => {
    const res = await post({ token: 't-1', senha: 'Aa1' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when password lacks uppercase', async () => {
    const res = await post({ token: 't-1', senha: 'senha123' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when password lacks number', async () => {
    const res = await post({ token: 't-1', senha: 'Senhalonga' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when token is invalid', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null)

    const res = await post({ token: 'bad', senha: 'Senha123' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when token is expired', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: 'u-1',
      tokenResetExpira: new Date(Date.now() - 60_000),
    })

    const res = await post({ token: 'expired', senha: 'Senha123' })
    expect(res.status).toBe(400)
  })

  it('hashes password, clears token, and succeeds when token is valid', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: 'u-1',
      tokenResetExpira: new Date(Date.now() + 60_000),
    })

    const res = await post({ token: 'ok', senha: 'Senha123' })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(bcryptMock.hash).toHaveBeenCalledWith('Senha123', 12)
    expect(prismaMock.usuario.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: {
        senha: 'hashed_Senha123',
        senhaDefinida: true,
        tokenReset: null,
        tokenResetExpira: null,
      },
    })
    expect(json.success).toBe(true)
  })
})
