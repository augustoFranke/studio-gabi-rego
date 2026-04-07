import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deletePagamentoById,
  getPagamentoById,
  PagamentoServiceError,
  updatePagamentoById,
} from '@/services/pagamento.service'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    pagamento: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('@/lib/schedule', () => ({
  parseLocalDate: vi.fn((date: string) => new Date(date)),
}))

describe('pagamento.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getPagamentoById loads payment with member and plan', async () => {
    vi.mocked(prisma.pagamento.findUnique).mockResolvedValueOnce(null)

    await getPagamentoById('pag-1')

    expect(prisma.pagamento.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pag-1' },
        include: expect.objectContaining({
          membro: expect.any(Object),
          plano: true,
        }),
      })
    )
  })

  it('updatePagamentoById throws when payment is missing', async () => {
    vi.mocked(prisma.pagamento.findUnique).mockResolvedValueOnce(null)

    await expect(
      updatePagamentoById('pag-1', { status: 'PAGO' })
    ).rejects.toMatchObject({
      code: 'PAGAMENTO_NOT_FOUND',
      status: 404,
    } satisfies Partial<PagamentoServiceError>)
  })

  it('deletePagamentoById cancels paid payment instead of removing it', async () => {
    vi.mocked(prisma.pagamento.findUnique)
      .mockResolvedValueOnce({ id: 'pag-1', status: 'PAGO' })
    vi.mocked(prisma.pagamento.update).mockResolvedValueOnce({
      id: 'pag-1',
      status: 'CANCELADO',
    })

    const result = await deletePagamentoById('pag-1')

    expect(prisma.pagamento.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pag-1' },
        data: { status: 'CANCELADO' },
      })
    )
    expect(result).toEqual({ id: 'pag-1', status: 'CANCELADO' })
  })
})
