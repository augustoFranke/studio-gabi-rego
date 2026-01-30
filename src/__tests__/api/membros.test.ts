import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse, type NextRequest } from 'next/server'
import { POST } from '@/app/api/membros/route'
import { prisma } from '@/lib/prisma'
import { createJsonRequest } from '@/__tests__/test-utils'
import type { MockValidationOptions, MockValidationSchema } from '@/__tests__/test-utils'

// Mocks
const { withApiAuthMock, validateRequestMock } = vi.hoisted(() => {
  const sessionRef = {
    current: { user: { role: 'ADMIN' as const } },
  } as { current: { user: { role: 'ADMIN' | 'MEMBRO' } } }

  return {
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
    validateRequestMock: vi.fn(async (request: NextRequest, schema: MockValidationSchema, options?: MockValidationOptions) => {
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
  prisma: {
    membro: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    usuario: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(prisma)),
  },
}))

vi.mock('@/lib/api', () => ({
  withApiAuth: withApiAuthMock,
  validateRequest: validateRequestMock,
}))

vi.mock('bcryptjs', () => ({
  hash: vi.fn((pwd) => Promise.resolve(`hashed_${pwd}`)),
}))

vi.mock('@/lib/validators', () => ({
  validarCPF: vi.fn(() => true),
  validarEmail: vi.fn(() => true),
}))

describe('Membros API - POST /api/membros', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createRequest = (body: Record<string, unknown>) =>
    createJsonRequest('http://localhost:3000/api/membros', body)

  it('should create a new member successfully', async () => {
    const validBody = {
      nome: 'John Doe',
      email: 'john@example.com',
      cpf: '123.456.789-00',
      senha: 'password123',
    }

    vi.mocked(prisma.usuario.findUnique).mockResolvedValue(null) // Email check
    vi.mocked(prisma.membro.findUnique).mockResolvedValue(null) // CPF check
    const createdUser = { id: 'user-123' } satisfies { id: string }
    vi.mocked(prisma.usuario.create).mockResolvedValue(createdUser)
    const createdMember = {
      id: 'membro-123',
      usuarioId: 'user-123',
      status: 'ATIVO',
    } satisfies { id: string; usuarioId: string; status: string }
    vi.mocked(prisma.membro.create).mockResolvedValue(createdMember)

    const req = createRequest(validBody)
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(prisma.usuario.create).toHaveBeenCalled()
    expect(prisma.membro.create).toHaveBeenCalled()
    expect(json.id).toBe('membro-123')
  })

  it('should return error if email already exists', async () => {
    const existingUser = { id: 'existing' } satisfies { id: string }
    vi.mocked(prisma.usuario.findUnique).mockResolvedValue(existingUser)
    
    const req = createRequest({ email: 'exists@example.com' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('email já está cadastrado')
  })

  it('should return error if CPF already exists', async () => {
     vi.mocked(prisma.usuario.findUnique).mockResolvedValue(null)
     const existingMember = { id: 'existing' } satisfies { id: string }
     vi.mocked(prisma.membro.findUnique).mockResolvedValue(existingMember)

     const req = createRequest({ cpf: '123.456.789-00', email: 'new@example.com' })
     const res = await POST(req)
     const json = await res.json()

     expect(res.status).toBe(400)
     expect(json.error).toContain('CPF já está cadastrado')
  })
})
