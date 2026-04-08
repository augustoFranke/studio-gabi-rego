import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PUT, DELETE, GET } from '@/app/api/pagamentos/[id]/route'
import { NextRequest } from 'next/server'

const {
  authMock,
  prismaMock,
  getPagamentoByIdMock,
  updatePagamentoByIdMock,
  deletePagamentoByIdMock,
  PagamentoServiceErrorMock,
} = vi.hoisted(() => {
  class PagamentoServiceErrorMock extends Error {
    constructor(
      message: string,
      public code: string,
      public status: number
    ) {
      super(message)
      this.name = 'PagamentoServiceError'
    }
  }

  return {
    authMock: vi.fn(),
    prismaMock: {
      pagamento: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    },
    getPagamentoByIdMock: vi.fn(),
    updatePagamentoByIdMock: vi.fn(),
    deletePagamentoByIdMock: vi.fn(),
    PagamentoServiceErrorMock,
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}))

vi.mock('@/services/pagamento.service', () => ({
  getPagamentoById: getPagamentoByIdMock,
  updatePagamentoById: updatePagamentoByIdMock,
  deletePagamentoById: deletePagamentoByIdMock,
  PagamentoServiceError: PagamentoServiceErrorMock,
}))

describe('Pagamentos API - /api/pagamentos/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const params = Promise.resolve({ id: 'pag-123' })

  describe('GET', () => {
    it('should return payment for admin', async () => {
      authMock.mockResolvedValueOnce({ user: { id: 'u-admin', role: 'ADMIN' } })
      getPagamentoByIdMock.mockResolvedValueOnce({
        id: 'pag-123',
        membroId: 'm-1',
      })

      const res = await GET(new NextRequest('http://localhost:3000/api/pagamentos/pag-123'), { params })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.id).toBe('pag-123')
    })

    it('should deny access to non-owners', async () => {
      authMock.mockResolvedValueOnce({ user: { id: 'u-2', role: 'MEMBRO', membroId: 'm-2' } })
      getPagamentoByIdMock.mockResolvedValueOnce({
        id: 'pag-123',
        membroId: 'm-1',
      })

      const res = await GET(new NextRequest('http://localhost:3000/api/pagamentos/pag-123'), { params })

      expect(res.status).toBe(403)
    })
  })

  describe('PUT (Update Status)', () => {
    it('should update payment status to PAGO', async () => {
      authMock.mockResolvedValueOnce({ user: { id: 'u-admin', role: 'ADMIN' } })
      updatePagamentoByIdMock.mockResolvedValueOnce({
        id: 'pag-123',
        status: 'PAGO',
        membroId: 'membro-123',
        dataVencimento: new Date('2026-01-20T12:00:00.000Z'),
      })
      prismaMock.pagamento.findFirst.mockResolvedValueOnce(null)

      const req = new NextRequest('http://localhost:3000/api/pagamentos/pag-123', {
        method: 'PUT',
        body: JSON.stringify({ status: 'PAGO', formaPagamento: 'PIX' }),
      })

      const res = await PUT(req, { params })
      const json = await res.json()

      expect(updatePagamentoByIdMock).toHaveBeenCalledWith(
        'pag-123',
        expect.objectContaining({
          status: 'PAGO',
          formaPagamento: 'PIX',
        })
      )
      expect(res.status).toBe(200)
      expect(json.status).toBe('PAGO')
    })

    it('should sync the next pending payment to the paid billing day', async () => {
      authMock.mockResolvedValueOnce({ user: { id: 'u-admin', role: 'ADMIN' } })

      const req = new NextRequest('http://localhost:3000/api/pagamentos/pag-123', {
        method: 'PUT',
        body: JSON.stringify({ status: 'PAGO', formaPagamento: 'PIX' }),
      })

      const paidPagamento = {
        id: 'pag-123',
        status: 'PAGO',
        membroId: 'membro-123',
        dataVencimento: new Date('2026-01-20T12:00:00.000Z'),
        dataPagamento: new Date('2026-01-05T12:00:00.000Z'),
      }

      const nextPendingPagamento = {
        id: 'pag-456',
        dataVencimento: new Date('2026-02-10T12:00:00.000Z'),
      }

      updatePagamentoByIdMock.mockResolvedValueOnce(paidPagamento)
      prismaMock.pagamento.findFirst.mockResolvedValueOnce(nextPendingPagamento)
      prismaMock.pagamento.update.mockResolvedValueOnce({
        ...nextPendingPagamento,
        dataVencimento: new Date('2026-02-20T12:00:00.000Z'),
      })

      await PUT(req, { params })

      expect(prismaMock.pagamento.findFirst).toHaveBeenCalledWith({
        where: {
          id: { not: 'pag-123' },
          membroId: 'membro-123',
          status: 'PENDENTE',
          dataVencimento: { gt: paidPagamento.dataVencimento },
        },
        orderBy: { dataVencimento: 'asc' },
      })

      const syncCall = prismaMock.pagamento.update.mock.calls[0]?.[0]
      expect(syncCall).toEqual({
        where: { id: 'pag-456' },
        data: { dataVencimento: expect.any(Date) },
      })
      expect((syncCall?.data.dataVencimento as Date).toISOString()).toContain('2026-02-20')
    })

    it('should deny access to non-admins', async () => {
      authMock.mockResolvedValueOnce({ user: { id: 'u-1', role: 'MEMBRO' } })
      const req = new NextRequest('http://localhost:3000/api', { method: 'PUT' })
      const res = await PUT(req, { params })
      expect(res.status).toBe(403)
    })
  })

  describe('DELETE (Cancel/Remove)', () => {
    it('should cancel payment if status is PAGO', async () => {
      authMock.mockResolvedValueOnce({ user: { id: 'u-admin', role: 'ADMIN' } })
      deletePagamentoByIdMock.mockResolvedValueOnce({
        id: 'pag-123',
        status: 'CANCELADO',
      })

      const req = new NextRequest('http://localhost:3000/api', { method: 'DELETE' })
      const res = await DELETE(req, { params })
      const json = await res.json()

      expect(deletePagamentoByIdMock).toHaveBeenCalledWith('pag-123')
      expect(res.status).toBe(200)
      expect(json.message).toBe('Pagamento cancelado')
    })

    it('should delete payment if status is PENDENTE', async () => {
      authMock.mockResolvedValueOnce({ user: { id: 'u-admin', role: 'ADMIN' } })
      deletePagamentoByIdMock.mockResolvedValueOnce({
        id: 'pag-123',
      })

      const req = new NextRequest('http://localhost:3000/api', { method: 'DELETE' })
      const res = await DELETE(req, { params })
      const json = await res.json()

      expect(deletePagamentoByIdMock).toHaveBeenCalledWith('pag-123')
      expect(res.status).toBe(200)
      expect(json.message).toBe('Pagamento removido com sucesso')
    })

    it('should return 404 when payment is missing', async () => {
      authMock.mockResolvedValueOnce({ user: { id: 'u-admin', role: 'ADMIN' } })
      deletePagamentoByIdMock.mockRejectedValueOnce(
        new PagamentoServiceErrorMock('Pagamento não encontrado', 'PAGAMENTO_NOT_FOUND', 404)
      )

      const req = new NextRequest('http://localhost:3000/api', { method: 'DELETE' })
      const res = await DELETE(req, { params })
      const json = await res.json()

      expect(res.status).toBe(404)
      expect(json.error).toContain('Pagamento não encontrado')
    })
  })
})
