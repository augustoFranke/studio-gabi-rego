import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH } from '@/app/api/membros/[id]/route'
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
      update: vi.fn(),
    },
    usuario: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(prisma)),
  },
}))

vi.mock('@/lib/api', () => ({
  withApiAuth: withApiAuthMock,
  validateRequest: validateRequestMock,
}))

vi.mock('@/lib/validators', () => ({
  validarCPF: vi.fn(() => true),
  validarEmail: vi.fn(() => true),
}))

describe('Membros API - PATCH /api/membros/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createRequest = (body: Record<string, unknown>) =>
    createJsonRequest('http://localhost:3000/api/membros/123', body, 'PATCH')

  const params = Promise.resolve({ id: '123' })

  it('should update member details successfully', async () => {
    const updateBody = {
      nome: 'John Updated',
      email: 'john.updated@example.com',
      cpf: '111.222.333-44'
    }

    // Mock existing member
    const existingMember = {
      id: '123',
      usuarioId: 'user-123',
      cpf: '00000000000',
      usuario: { email: 'old@example.com' }
    } satisfies { id: string; usuarioId: string; cpf: string | null; usuario: { email: string } }
    vi.mocked(prisma.membro.findUnique).mockResolvedValueOnce(existingMember)

    // Mock email/cpf checks
    vi.mocked(prisma.usuario.findUnique).mockResolvedValue(null) // Email unique check
    vi.mocked(prisma.membro.findUnique).mockResolvedValueOnce(null) // CPF unique check (second call)

    const updatedMember = {
      id: '123',
      usuarioId: 'user-123',
    } satisfies { id: string; usuarioId: string }
    vi.mocked(prisma.membro.update).mockResolvedValue(updatedMember)

    const req = createRequest(updateBody)
    const res = await PATCH(req, { params })
    const json = await res.json()

    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: { nome: updateBody.nome, email: updateBody.email },
    })
    expect(prisma.membro.update).toHaveBeenCalled()
    expect(json.id).toBe('123')
  })

  it('should return 404 if member not found', async () => {
    vi.mocked(prisma.membro.findUnique).mockResolvedValue(null)

    const req = createRequest({ nome: 'Ghost' })
    const res = await PATCH(req, { params })

    expect(res.status).toBe(404)
  })

  it('should clear email to null when empty email is sent', async () => {
    const existingMember = {
      id: '123',
      usuarioId: 'user-123',
      cpf: '00000000000',
      usuario: { email: 'old@example.com' },
    } satisfies { id: string; usuarioId: string; cpf: string | null; usuario: { email: string } }
    vi.mocked(prisma.membro.findUnique).mockResolvedValueOnce(existingMember)
    const updatedMember = {
      id: '123',
      usuarioId: 'user-123',
    } satisfies { id: string; usuarioId: string }
    vi.mocked(prisma.membro.update).mockResolvedValue(updatedMember)

    const req = createRequest({ email: '' })
    const res = await PATCH(req, { params })

    expect(res.status).toBe(200)
    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: { email: null },
    })
  })
})
