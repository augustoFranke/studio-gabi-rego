import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/auth/cadastro/route'

const {
  prismaMock,
  resendMock,
  rateLimitMock,
  bcryptMock,
  cryptoMock,
  validatorsMock,
} = vi.hoisted(() => ({
  prismaMock: {
    usuario: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
  resendMock: {
    enviarEmail: vi.fn(async () => ({ success: true, id: 'email-1' })),
    isResendConfigured: vi.fn(() => true),
    emailTemplates: {
      completarPerfil: vi.fn((_nome: string | null, link: string) => `completar:${link}`),
      verificacaoEmail: vi.fn((_nome: string | null, link: string) => `verificar:${link}`),
    },
  },
  rateLimitMock: vi.fn(async () => ({ success: true })),
  bcryptMock: {
    hash: vi.fn(async (value: string) => `hashed_${value}`),
  },
  cryptoMock: {
    randomBytes: vi.fn(() => Buffer.from('b'.repeat(32))),
  },
  validatorsMock: {
    validarEmail: vi.fn(() => true),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/resend', () => resendMock)

vi.mock('@/lib/rate-limit', () => ({
  rateLimitByIp: rateLimitMock,
}))

vi.mock('bcryptjs', () => bcryptMock)

vi.mock('crypto', () => cryptoMock)

vi.mock('@/lib/validators', () => validatorsMock)

describe('Auth API - POST /api/auth/cadastro', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimitMock.mockResolvedValue({ success: true })
    validatorsMock.validarEmail.mockReturnValue(true)
    resendMock.isResendConfigured.mockReturnValue(true)
    resendMock.enviarEmail.mockResolvedValue({ success: true, id: 'email-1' })
    prismaMock.usuario.findUnique.mockResolvedValue(null)
  })

  const post = (body: Record<string, unknown>) =>
    POST(
      new Request('http://localhost:3000/api/auth/cadastro', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    )

  it('returns 429 when rate limit denies request', async () => {
    rateLimitMock.mockResolvedValue({ success: false })

    const res = await post({ email: 'x@example.com', senha: 'Senha123' })
    expect(res.status).toBe(429)
  })

  it('returns 400 for invalid email', async () => {
    validatorsMock.validarEmail.mockReturnValue(false)

    const res = await post({ email: 'invalid', senha: 'Senha123' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is missing complexity requirements', async () => {
    const noUppercase = await post({ email: 'x@example.com', senha: 'senha123' })
    expect(noUppercase.status).toBe(400)

    const noNumber = await post({ email: 'x@example.com', senha: 'SenhaLonga' })
    expect(noNumber.status).toBe(400)
  })

  it('creates a new user and returns success for valid signup', async () => {
    const res = await post({ email: '  Aluno@Example.com ', senha: 'Senha123' })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.usuario.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'aluno@example.com',
        senha: 'hashed_Senha123',
        tokenVerificacao: expect.any(String),
        tokenVerificacaoExpira: expect.any(Date),
      }),
    })
    expect(resendMock.enviarEmail).toHaveBeenCalled()
    expect(json.success).toBe(true)
  })

  it('returns 500 when resend is not configured for new user flow', async () => {
    resendMock.isResendConfigured.mockReturnValue(false)

    const res = await post({ email: 'aluno@example.com', senha: 'Senha123' })
    expect(res.status).toBe(500)
    expect(prismaMock.usuario.create).toHaveBeenCalled()
  })

  it('updates unverified existing user and returns success', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: 'u-1',
      nome: 'Aluno',
      emailVerificado: null,
      onboardingCompleto: false,
      membro: null,
    })

    const res = await post({ email: 'aluno@example.com', senha: 'Senha123' })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.usuario.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: expect.objectContaining({
        senha: 'hashed_Senha123',
        tokenVerificacao: expect.any(String),
        tokenVerificacaoExpira: expect.any(Date),
      }),
    })
    expect(json.success).toBe(true)
  })
})
