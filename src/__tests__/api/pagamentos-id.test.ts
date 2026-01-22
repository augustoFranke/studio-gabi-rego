import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PUT, DELETE } from '@/app/api/pagamentos/[id]/route'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Mocks
vi.mock('@/lib/prisma', () => ({
  prisma: {
    pagamento: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

import { auth } from '@/lib/auth'

describe('Pagamentos API - /api/pagamentos/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const params = Promise.resolve({ id: 'pag-123' })

  describe('PUT (Update Status)', () => {
    it('should update payment status to PAGO', async () => {
      const adminSession = { user: { role: 'ADMIN' } } satisfies { user: { role: string } }
      vi.mocked(auth).mockResolvedValue(adminSession)
      
      const req = new NextRequest('http://localhost:3000/api/pagamentos/pag-123', {
        method: 'PUT',
        body: JSON.stringify({ status: 'PAGO', formaPagamento: 'PIX' }),
      })

      const updatedPagamento = {
        id: 'pag-123',
        status: 'PAGO',
      } satisfies { id: string; status: string }
      vi.mocked(prisma.pagamento.update).mockResolvedValue(updatedPagamento)

      const res = await PUT(req, { params })
      const json = await res.json()

      expect(prisma.pagamento.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'pag-123' },
        data: expect.objectContaining({ status: 'PAGO' }),
      }))
      expect(json.status).toBe('PAGO')
    })

    it('should deny access to non-admins', async () => {
      const memberSession = { user: { role: 'MEMBRO' } } satisfies { user: { role: string } }
      vi.mocked(auth).mockResolvedValue(memberSession)
      const req = new NextRequest('http://localhost:3000/api', { method: 'PUT' })
      const res = await PUT(req, { params })
      expect(res.status).toBe(401)
    })
  })

  describe('DELETE (Cancel/Remove)', () => {
    it('should cancel payment if status is PAGO', async () => {
      const adminSession = { user: { role: 'ADMIN' } } satisfies { user: { role: string } }
      vi.mocked(auth).mockResolvedValue(adminSession)
      const existingPagamento = {
        id: 'pag-123',
        status: 'PAGO',
      } satisfies { id: string; status: string }
      vi.mocked(prisma.pagamento.findUnique).mockResolvedValue(existingPagamento)
      const cancelledPagamento = {
        id: 'pag-123',
        status: 'CANCELADO',
      } satisfies { id: string; status: string }
      vi.mocked(prisma.pagamento.update).mockResolvedValue(cancelledPagamento)

      const req = new NextRequest('http://localhost:3000/api', { method: 'DELETE' })
      await DELETE(req, { params })
      
      expect(prisma.pagamento.update).toHaveBeenCalledWith({
        where: { id: 'pag-123' },
        data: { status: 'CANCELADO' },
      })
    })

    it('should delete payment if status is PENDENTE', async () => {
      const adminSession = { user: { role: 'ADMIN' } } satisfies { user: { role: string } }
      vi.mocked(auth).mockResolvedValue(adminSession)
      const pendingPagamento = {
        id: 'pag-123',
        status: 'PENDENTE',
      } satisfies { id: string; status: string }
      vi.mocked(prisma.pagamento.findUnique).mockResolvedValue(pendingPagamento)

      const req = new NextRequest('http://localhost:3000/api', { method: 'DELETE' })
      await DELETE(req, { params })
      
      expect(prisma.pagamento.delete).toHaveBeenCalledWith({
        where: { id: 'pag-123' },
      })
    })
  })
})
