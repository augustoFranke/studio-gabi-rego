import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/auth/validar-token-reset/route'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

describe('Auth API - GET /api/auth/validar-token-reset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns valid=false when token is missing', async () => {
    const res = await GET(new Request('http://localhost:3000/api/auth/validar-token-reset'))
    const json = await res.json()

    expect(json.valid).toBe(false)
  })

  it('returns valid=false when token is not found', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null)

    const res = await GET(
      new Request('http://localhost:3000/api/auth/validar-token-reset?token=bad')
    )
    const json = await res.json()

    expect(json.valid).toBe(false)
  })

  it('returns valid=false when token is expired', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: 'u-1',
      tokenResetExpira: new Date(Date.now() - 60_000),
    })

    const res = await GET(
      new Request('http://localhost:3000/api/auth/validar-token-reset?token=expired')
    )
    const json = await res.json()

    expect(json.valid).toBe(false)
  })

  it('returns valid=true when token exists and is not expired', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: 'u-1',
      tokenResetExpira: new Date(Date.now() + 60_000),
    })

    const res = await GET(
      new Request('http://localhost:3000/api/auth/validar-token-reset?token=ok')
    )
    const json = await res.json()

    expect(json.valid).toBe(true)
  })
})
