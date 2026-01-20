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
      vi.mocked(auth).mockResolvedValue({ user: { role: 'ADMIN' } } as any)
      
      const req = new NextRequest('http://localhost:3000/api/pagamentos/pag-123', {
        method: 'PUT',
        body: JSON.stringify({ status: 'PAGO', formaPagamento: 'PIX' }),
      })

      vi.mocked(prisma.pagamento.update).mockResolvedValue({
        id: 'pag-123',
        status: 'PAGO',
      } as any)

      const res = await PUT(req, { params })
      const json = await res.json()

      expect(prisma.pagamento.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'pag-123' },
        data: expect.objectContaining({ status: 'PAGO' }),
      }))
      expect(json.status).toBe('PAGO')
    })

    it('should deny access to non-admins', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { role: 'MEMBRO' } } as any)
      const req = new NextRequest('http://localhost:3000/api', { method: 'PUT' })
      const res = await PUT(req, { params })
      expect(res.status).toBe(401)
    })
  })

  describe('DELETE (Cancel/Remove)', () => {
    it('should cancel payment if status is PAGO', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { role: 'ADMIN' } } as any)
      vi.mocked(prisma.pagamento.findUnique).mockResolvedValue({
        id: 'pag-123',
        status: 'PAGO',
      } as any)
      vi.mocked(prisma.pagamento.update).mockResolvedValue({
        id: 'pag-123',
        status: 'CANCELADO',
      } as any)

      const req = new NextRequest('http://localhost:3000/api', { method: 'DELETE' })
      const res = await DELETE(req, { params })
      
      expect(prisma.pagamento.update).toHaveBeenCalledWith({
        where: { id: 'pag-123' },
        data: { status: 'CANCELADO' },
      })
    })

    it('should delete payment if status is PENDENTE', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { role: 'ADMIN' } } as any)
      vi.mocked(prisma.pagamento.findUnique).mockResolvedValue({
        id: 'pag-123',
        status: 'PENDENTE',
      } as any)

      const req = new NextRequest('http://localhost:3000/api', { method: 'DELETE' })
      const res = await DELETE(req, { params })
      
      expect(prisma.pagamento.delete).toHaveBeenCalledWith({
        where: { id: 'pag-123' },
      })
    })
  })
})
