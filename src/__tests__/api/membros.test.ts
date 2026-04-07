import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/membros/route'
import { createJsonRequest } from '@/__tests__/test-utils'

const {
  withApiAuthMock,
  validateRequestMock,
  createAdminMembroMock,
  MembroServiceErrorMock,
} = vi.hoisted(() => {
  const { createSessionRef, createValidateRequestMock, mockWithApiAuth } = globalThis.__testUtils
  const sessionRef = createSessionRef({ user: { role: 'ADMIN' } })

  class MembroServiceErrorMock extends Error {
    constructor(
      message: string,
      public code: string,
      public status: number
    ) {
      super(message)
      this.name = 'MembroServiceError'
    }
  }

  return {
    withApiAuthMock: mockWithApiAuth(sessionRef).withApiAuth,
    validateRequestMock: createValidateRequestMock(),
    createAdminMembroMock: vi.fn(),
    MembroServiceErrorMock,
  }
})

vi.mock('@/lib/api', () => ({
  withApiAuth: withApiAuthMock,
  validateRequest: validateRequestMock,
}))

vi.mock('@/services/membro.service', () => ({
  createAdminMembro: createAdminMembroMock,
  listMembros: vi.fn(),
  MembroServiceError: MembroServiceErrorMock,
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

    createAdminMembroMock.mockResolvedValueOnce({
      id: 'membro-123',
      usuarioId: 'user-123',
      status: 'ATIVO',
    })

    const req = createRequest(validBody)
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(createAdminMembroMock).toHaveBeenCalledWith(validBody)
    expect(json.id).toBe('membro-123')
  })

  it('should return error if email already exists', async () => {
    createAdminMembroMock.mockRejectedValueOnce(
      new MembroServiceErrorMock('Este email já está cadastrado no sistema.', 'EMAIL_ALREADY_EXISTS', 400)
    )

    const req = createRequest({ email: 'exists@example.com' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('email já está cadastrado')
  })

  it('should return error if CPF already exists', async () => {
    createAdminMembroMock.mockRejectedValueOnce(
      new MembroServiceErrorMock('Este CPF já está cadastrado para outro membro.', 'CPF_ALREADY_EXISTS', 400)
    )

    const req = createRequest({ cpf: '123.456.789-00', email: 'new@example.com' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('CPF já está cadastrado')
  })

  it('should create member with null email when email is missing', async () => {
    createAdminMembroMock.mockResolvedValueOnce({
      id: 'membro-456',
      usuarioId: 'user-456',
      status: 'ATIVO',
    })

    const req = createRequest({ nome: 'Sem Email', cpf: '123.456.789-11' })
    const res = await POST(req)

    expect(res.status).toBe(201)
    expect(createAdminMembroMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: 'Sem Email',
        cpf: '123.456.789-11',
      })
    )
  })
})
