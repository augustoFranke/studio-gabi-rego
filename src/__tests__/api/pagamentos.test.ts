import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/pagamentos/route'
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
    pagamento: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/api', () => ({
  withApiAuth: withApiAuthMock,
  validateRequest: validateRequestMock,
}))

vi.mock('@/lib/schedule', () => ({
  parseLocalDate: vi.fn((date) => new Date(date)),
}))

describe('Pagamentos API - POST /api/pagamentos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createRequest = (body: Record<string, unknown>) =>
    createJsonRequest('http://localhost:3000/api/pagamentos', body)

  it('should create a new payment successfully', async () => {
    const validBody = {
      membroId: 'membro-123',
      planoId: 'plano-123',
      valor: 100.00,
      dataVencimento: '2026-01-20',
      formaPagamento: 'PIX',
    }

    const createdPagamento = {
      id: 'pag-123',
      ...validBody,
    } satisfies { id: string }
    vi.mocked(prisma.pagamento.create).mockResolvedValue(createdPagamento)

    const req = createRequest(validBody)
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(prisma.pagamento.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        membroId: 'membro-123',
        valor: 100.00,
      }),
    }))
    expect(json.id).toBe('pag-123')
  })

  it('should return error for invalid data', async () => {
    const invalidBody = {
      valor: 'not a number', // schema expects number
    }

    const req = createRequest(invalidBody)
    const res = await POST(req)
    
    expect(res.status).toBe(400)
    expect(prisma.pagamento.create).not.toHaveBeenCalled()
  })
})
