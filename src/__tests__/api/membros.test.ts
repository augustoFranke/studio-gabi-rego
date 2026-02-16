import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/membros/route'
import { prisma } from '@/lib/prisma'
import { createJsonRequest } from '@/__tests__/test-utils'

// Mocks
const { withApiAuthMock, validateRequestMock } = vi.hoisted(() => {
  const { createSessionRef, createValidateRequestMock, mockWithApiAuth } = globalThis.__testUtils
  const sessionRef = createSessionRef({ user: { role: 'ADMIN' } })

  return {
    withApiAuthMock: mockWithApiAuth(sessionRef).withApiAuth,
    validateRequestMock: createValidateRequestMock(),
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
      senha: 'Senha123',
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
