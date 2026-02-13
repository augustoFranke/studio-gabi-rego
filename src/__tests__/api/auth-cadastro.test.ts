import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/auth/cadastro/route'

const {
  prismaMock,
  resendMock,
  rateLimitMock,
  bcryptMock,
  cryptoMock,
  validatorsMock,
  anamneseMock,
} = vi.hoisted(() => ({
  prismaMock: {
    usuario: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    membro: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    anamnese: {
      create: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<void>) => fn({
      usuario: {
        update: vi.fn(),
        create: vi.fn(async () => ({ id: 'new-user-id' })),
      },
      membro: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: 'new-membro-id' })),
        delete: vi.fn(),
      },
      anamnese: {
        create: vi.fn(),
      },
    })),
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
  anamneseMock: {
    sanitizeAnamnesePayload: vi.fn((_payload: Record<string, unknown>) => ({ data: _payload }) as { data: Record<string, unknown> } | { error: string }),
    ANAMNESE_FIELDS: new Set(['altura', 'pesoAtual', 'objetivo']),
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

vi.mock('@/lib/anamnese', () => anamneseMock)

describe('Auth API - POST /api/auth/cadastro', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimitMock.mockResolvedValue({ success: true })
    validatorsMock.validarEmail.mockReturnValue(true)
    resendMock.isResendConfigured.mockReturnValue(true)
    resendMock.enviarEmail.mockResolvedValue({ success: true, id: 'email-1' })
    prismaMock.usuario.findUnique.mockResolvedValue(null)
    anamneseMock.sanitizeAnamnesePayload.mockReturnValue({ data: { altura: '1.70' } })
  })

  const post = (body: Record<string, unknown>) =>
    POST(
      new Request('http://localhost:3000/api/auth/cadastro', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    )

  const fullPayload = {
    email: 'aluno@example.com',
    senha: 'Senha123',
    nome: 'Maria Silva',
    cpf: '12345678901',
    telefone: '11999998888',
    dataNascimento: '2000-01-15',
    sexo: 'FEMININO',
    anamnese: { altura: '1.70' },
  }

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

  it('creates a new user and returns success for simple signup (email + password only)', async () => {
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

  it('creates user + membro + anamnese atomically for full payload', async () => {
    const res = await post(fullPayload)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prismaMock.$transaction).toHaveBeenCalled()
    expect(resendMock.enviarEmail).toHaveBeenCalled()
  })

  it('returns 400 when nome is too short in full payload', async () => {
    const res = await post({ ...fullPayload, nome: 'AB' })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Nome')
  })

  it('returns 400 when CPF is invalid length in full payload', async () => {
    const res = await post({ ...fullPayload, cpf: '123' })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('CPF')
  })

  it('returns 400 when telefone is too short in full payload', async () => {
    const res = await post({ ...fullPayload, telefone: '123' })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Telefone')
  })

  it('returns 400 when age is under 16 in full payload', async () => {
    const recentDate = new Date()
    recentDate.setFullYear(recentDate.getFullYear() - 10)
    const res = await post({ ...fullPayload, dataNascimento: recentDate.toISOString().split('T')[0] })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('16 anos')
  })

  it('returns 400 when sexo is invalid in full payload', async () => {
    const res = await post({ ...fullPayload, sexo: 'OUTRO' })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Sexo')
  })

  it('returns 400 when anamnese validation fails', async () => {
    anamneseMock.sanitizeAnamnesePayload.mockReturnValue({ error: 'Dados inválidos' })
    const res = await post(fullPayload)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Dados inválidos')
  })

  it('returns generic success when verified user with membro tries to register', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: 'u-1',
      nome: 'Aluno',
      emailVerificado: new Date(),
      onboardingCompleto: true,
      membro: { id: 'm-1' },
    })

    const res = await post(fullPayload)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    // Should NOT create anything
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})
