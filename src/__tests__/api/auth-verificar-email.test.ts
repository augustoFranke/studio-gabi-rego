import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/auth/verificar-email/route'

const { prismaMock, resendMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    membro: {
      update: vi.fn(),
    },
  },
  resendMock: {
    enviarEmail: vi.fn(async () => ({ success: true, id: 'email-1' })),
    isResendConfigured: vi.fn(() => true),
    emailTemplates: {
      boasVindas: vi.fn((nome: string) => `boas-vindas:${nome}`),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/resend', () => resendMock)

describe('Auth API - POST /api/auth/verificar-email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resendMock.isResendConfigured.mockReturnValue(true)
    resendMock.enviarEmail.mockResolvedValue({ success: true, id: 'email-1' })
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
      role: 'MEMBRO',
      email: 'aluno@example.com',
      nome: 'Aluno',
      tokenVerificacaoExpira: new Date(Date.now() - 60_000),
      membro: null,
    })

    const res = await post({ token: 'expired' })
    expect(res.status).toBe(400)
  })

  it('marks email as verified, sets onboarding complete, and sends welcome email', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: 'u-1',
      role: 'MEMBRO',
      email: 'aluno@example.com',
      nome: 'Aluno',
      onboardingCompleto: false,
      tokenVerificacaoExpira: new Date(Date.now() + 60_000),
      membro: { id: 'm-1', anamnese: { id: 'a-1' } },
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
        etapaOnboarding: 4,
        onboardingCompleto: true,
      }),
    })
    expect(json.success).toBe(true)
    expect(json.nextStep).toBe('login')
    expect(json.redirectUrl).toContain('/login')
    expect(json.isAdmin).toBe(false)

    expect(resendMock.enviarEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        para: 'aluno@example.com',
        assunto: expect.stringContaining('Bem-vindo'),
      })
    )
  })

  it('does not return profileToken in response', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: 'u-1',
      role: 'MEMBRO',
      email: 'aluno@example.com',
      nome: 'Aluno',
      onboardingCompleto: false,
      tokenVerificacaoExpira: new Date(Date.now() + 60_000),
      membro: null,
    })

    const res = await post({ token: 'ok' })
    const json = await res.json()

    expect(json.profileToken).toBeUndefined()
    expect(json.nextStep).toBe('complete_profile')
    expect(json.redirectUrl).toContain('/completar-perfil?token=')
  })
})
