import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/auth/reenviar-verificacao/route'

const {
  prismaMock,
  resendMock,
  rateLimitMock,
  validatorsMock,
  cryptoMock,
} = vi.hoisted(() => ({
  prismaMock: {
    usuario: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  resendMock: {
    enviarEmail: vi.fn(async () => ({ success: true })),
    isResendConfigured: vi.fn(() => true),
    emailTemplates: {
      completarPerfil: vi.fn((_nome: string | null, link: string) => `completar:${link}`),
      verificacaoEmail: vi.fn((_nome: string | null, link: string) => `verificar:${link}`),
    },
  },
  rateLimitMock: vi.fn(async () => ({ success: true })),
  validatorsMock: {
    validarEmail: vi.fn(() => true),
  },
  cryptoMock: {
    randomBytes: vi.fn(() => Buffer.from('c'.repeat(32))),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/resend', () => resendMock)

vi.mock('@/lib/rate-limit', () => ({
  rateLimitByIp: rateLimitMock,
}))

vi.mock('@/lib/validators', () => validatorsMock)

vi.mock('crypto', () => cryptoMock)

describe('Auth API - POST /api/auth/reenviar-verificacao', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimitMock.mockResolvedValue({ success: true })
    validatorsMock.validarEmail.mockReturnValue(true)
    resendMock.isResendConfigured.mockReturnValue(true)
    resendMock.enviarEmail.mockResolvedValue({ success: true })
  })

  const post = (body: Record<string, unknown>) =>
    POST(
      new Request('http://localhost:3000/api/auth/reenviar-verificacao', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    )

  it('returns 429 when rate limit denies request', async () => {
    rateLimitMock.mockResolvedValue({ success: false })

    const res = await post({ email: 'x@example.com' })
    expect(res.status).toBe(429)
  })

  it('returns 400 when email is invalid', async () => {
    validatorsMock.validarEmail.mockReturnValue(false)

    const res = await post({ email: 'bad' })
    expect(res.status).toBe(400)
  })

  it('returns generic success when user is not found', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null)

    const res = await post({ email: 'x@example.com' })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prismaMock.usuario.update).not.toHaveBeenCalled()
  })

  it('updates verification token and sends email for unverified users', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: 'u-1',
      nome: 'Aluno',
      emailVerificado: null,
      onboardingCompleto: false,
      membro: null,
    })

    const res = await post({ email: 'x@example.com' })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.usuario.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: {
        tokenVerificacao: expect.any(String),
        tokenVerificacaoExpira: expect.any(Date),
      },
    })
    expect(resendMock.enviarEmail).toHaveBeenCalled()
    expect(json.success).toBe(true)
  })

  it('creates profile completion token flow for verified user without onboarding', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: 'u-2',
      nome: 'Aluno',
      emailVerificado: new Date(),
      onboardingCompleto: false,
      membro: null,
    })

    const res = await post({ email: 'x@example.com' })
    expect(res.status).toBe(200)
    expect(prismaMock.usuario.update).toHaveBeenCalledWith({
      where: { id: 'u-2' },
      data: expect.objectContaining({
        tokenReset: expect.any(String),
        tokenResetExpira: expect.any(Date),
        etapaOnboarding: 2,
      }),
    })
  })
})
