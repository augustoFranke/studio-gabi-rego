import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_SIGN_IN_FAILED, AUTH_SIGN_IN_OK } from '@/lib/observability/events'

const {
  nextAuthFactoryMock,
  credentialsProviderMock,
  compareMock,
  prismaFindUniqueMock,
  logWarnMock,
  logInfoMock,
} = vi.hoisted(() => ({
  nextAuthFactoryMock: vi.fn(),
  credentialsProviderMock: vi.fn((config) => config),
  compareMock: vi.fn(),
  prismaFindUniqueMock: vi.fn(),
  logWarnMock: vi.fn(),
  logInfoMock: vi.fn(),
}))

type CapturedAuthConfig = {
  providers: Array<{
    authorize: (credentials: unknown) => Promise<unknown>
  }>
}

let capturedConfig: CapturedAuthConfig | undefined

vi.mock('next-auth', () => ({
  default: nextAuthFactoryMock.mockImplementation((config) => {
    capturedConfig = config
    return {
      handlers: {},
      signIn: vi.fn(),
      signOut: vi.fn(),
      auth: vi.fn(),
    }
  }),
}))

vi.mock('next-auth/providers/credentials', () => ({
  default: credentialsProviderMock,
}))

vi.mock('bcryptjs', () => ({
  compare: compareMock,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    usuario: {
      findUnique: prismaFindUniqueMock,
    },
  },
}))

vi.mock('@/lib/observability/logger', () => ({
  logWarn: logWarnMock,
  logInfo: logInfoMock,
}))

describe('auth observability', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    capturedConfig = undefined
    process.env.NODE_ENV = 'production'
  })

  async function getAuthorize() {
    await import('@/lib/auth')
    return capturedConfig!.providers[0].authorize
  }

  it('logs stable sign-in failure classes without credentials', async () => {
    prismaFindUniqueMock.mockResolvedValueOnce(null)
    const authorize = await getAuthorize()

    await expect(
      authorize({
        email: 'User@example.com',
        password: 'super-secret-password',
      }),
    ).rejects.toThrow('INVALID_CREDENTIALS')

    expect(logWarnMock).toHaveBeenCalledWith(AUTH_SIGN_IN_FAILED, {
      reason: 'user_not_found',
    })

    const payload = logWarnMock.mock.calls[0][1]
    expect(payload).not.toHaveProperty('email')
    expect(payload).not.toHaveProperty('password')
  })

  it('logs stable wrong-password failures without leaking secrets', async () => {
    prismaFindUniqueMock.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@example.com',
      nome: 'User',
      role: 'MEMBRO',
      senha: 'hashed-password',
      emailVerificado: new Date('2026-01-01T00:00:00.000Z'),
      senhaDefinida: true,
      membro: null,
    })
    compareMock.mockResolvedValueOnce(false)
    const authorize = await getAuthorize()

    await expect(
      authorize({
        email: 'user@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toThrow('INVALID_CREDENTIALS')

    expect(logWarnMock).toHaveBeenCalledWith(AUTH_SIGN_IN_FAILED, {
      reason: 'wrong_password',
    })
    expect(logWarnMock.mock.calls[0][1]).not.toHaveProperty('password')
  })

  it('logs sign-in success with safe user metadata', async () => {
    prismaFindUniqueMock.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@example.com',
      nome: 'User',
      role: 'ADMIN',
      senha: 'hashed-password',
      emailVerificado: new Date('2026-01-01T00:00:00.000Z'),
      senhaDefinida: true,
      membro: { id: 'membro-1' },
    })
    compareMock.mockResolvedValueOnce(true)
    const authorize = await getAuthorize()

    const user = await authorize({
      email: 'user@example.com',
      password: 'correct-password',
    })

    expect(user).toMatchObject({
      id: 'user-1',
      email: 'user@example.com',
      role: 'ADMIN',
      membroId: 'membro-1',
    })
    expect(logInfoMock).toHaveBeenCalledWith(AUTH_SIGN_IN_OK, {
      userId: 'user-1',
      role: 'ADMIN',
    })
  })
})
