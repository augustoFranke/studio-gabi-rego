import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { POST } from '@/app/api/auth/enviar-reset-senha/route'
import type { MockValidationOptions, MockValidationSchema } from '@/__tests__/test-utils'

const { prismaMock, resendMock, sessionRef, cryptoMock, withApiAuthMock, validateRequestMock } = vi.hoisted(() => {
  const sessionRef = {
    current: { user: { role: 'ADMIN' as const, id: 'u-admin' } },
  } as { current: { user: { role: 'ADMIN' | 'MEMBRO'; id: string } } }

  return {
    prismaMock: {
      usuario: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    },
    resendMock: {
      enviarEmail: vi.fn(),
      isResendConfigured: vi.fn(() => true),
      emailTemplates: {
        redefinirSenha: vi.fn((_nome: string, link: string) => `<a href="${link}">reset</a>`),
      },
    },
    sessionRef,
    cryptoMock: {
      randomBytes: vi.fn(() => Buffer.from('a'.repeat(32))),
    },
    withApiAuthMock: vi.fn(
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
    validateRequestMock: vi.fn(async (request: Request, schema: MockValidationSchema, options?: MockValidationOptions) => {
      let body: unknown
      try {
        body = await request.json()
      } catch {
        return {
          error: NextResponse.json(
            { error: options?.invalidJsonMessage ?? 'Dados inválidos enviados. Verifique o formulário.' },
            { status: 400 }
          ),
        }
      }

      const validation = schema.safeParse(body)
      if (!validation.success) {
        const message =
          options?.errorMessage?.(validation.error) ??
          validation.error.issues[0]?.message ??
          'Dados inválidos enviados. Verifique o formulário.'
        return { error: NextResponse.json({ error: message }, { status: 400 }) }
      }

      return { data: validation.data }
    }),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/resend', () => resendMock)

vi.mock('crypto', () => cryptoMock)

vi.mock('@/lib/api', () => ({
  withApiAuth: withApiAuthMock,
  validateRequest: validateRequestMock,
}))

describe('Auth API - POST /api/auth/enviar-reset-senha', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionRef.current = { user: { role: 'ADMIN', id: 'u-admin' } }
    resendMock.isResendConfigured.mockReturnValue(true)
    resendMock.enviarEmail.mockResolvedValue({ success: true })
  })

  it('returns 403 when session is not ADMIN', async () => {
    sessionRef.current = { user: { role: 'MEMBRO', id: 'u-1' } }

    const res = await POST(
      new Request('http://localhost:3000/api/auth/enviar-reset-senha', {
        method: 'POST',
        body: JSON.stringify({ usuarioId: 'u-2' }),
      })
    )

    expect(res.status).toBe(403)
    expect(prismaMock.usuario.findUnique).not.toHaveBeenCalled()
  })

  it('returns 400 when usuarioId is missing', async () => {
    const res = await POST(
      new Request('http://localhost:3000/api/auth/enviar-reset-senha', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    )

    expect(res.status).toBe(400)
  })

  it('returns 404 when user is not found', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null)

    const res = await POST(
      new Request('http://localhost:3000/api/auth/enviar-reset-senha', {
        method: 'POST',
        body: JSON.stringify({ usuarioId: 'u-missing' }),
      })
    )

    expect(res.status).toBe(404)
  })

  it('returns 500 when email sending fails', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: 'u-2',
      nome: 'Aluno',
      email: 'aluno@example.com',
    })
    resendMock.enviarEmail.mockResolvedValue({ success: false, error: 'boom' })

    const res = await POST(
      new Request('http://localhost:3000/api/auth/enviar-reset-senha', {
        method: 'POST',
        body: JSON.stringify({ usuarioId: 'u-2' }),
      })
    )

    expect(res.status).toBe(500)
  })

  it('updates reset token and succeeds without resend configured', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: 'u-2',
      nome: 'Aluno',
      email: 'aluno@example.com',
    })
    resendMock.isResendConfigured.mockReturnValue(false)

    const res = await POST(
      new Request('http://localhost:3000/api/auth/enviar-reset-senha', {
        method: 'POST',
        body: JSON.stringify({ usuarioId: 'u-2' }),
      })
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u-2' },
        data: expect.objectContaining({
          tokenReset: expect.any(String),
          tokenResetExpira: expect.any(Date),
        }),
      })
    )
    expect(json.success).toBe(true)
  })
})
