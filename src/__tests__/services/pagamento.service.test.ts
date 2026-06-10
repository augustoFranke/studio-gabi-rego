import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deletePagamentoById,
  getPagamentoById,
  PagamentoServiceError,
  updatePagamentoById,
} from '@/services/pagamento.service'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => {
  const prismaMockClient = {
    pagamento: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }

  return {
    prisma: {
      ...prismaMockClient,
      $transaction: vi.fn(async (fn: (tx: typeof prismaMockClient) => unknown) => fn(prismaMockClient)),
    },
  }
})

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

  it('updatePagamentoById syncs the next pending payment to the paid billing day, clamped to month length', async () => {
    vi.mocked(prisma.pagamento.findUnique).mockResolvedValueOnce({ id: 'pag-1', status: 'PENDENTE' })

    const paidPagamento = {
      id: 'pag-1',
      status: 'PAGO',
      membroId: 'membro-1',
      dataVencimento: new Date('2026-01-31T12:00:00.000Z'),
    }

    const nextPendente = {
      id: 'pag-2',
      dataVencimento: new Date('2026-02-15T12:00:00.000Z'),
    }

    vi.mocked(prisma.pagamento.update).mockResolvedValueOnce(paidPagamento)
    vi.mocked(prisma.pagamento.findFirst).mockResolvedValueOnce(nextPendente)
    vi.mocked(prisma.pagamento.update).mockResolvedValueOnce({
      ...nextPendente,
      dataVencimento: new Date('2026-02-28T12:00:00.000Z'),
    })

    const result = await updatePagamentoById('pag-1', { status: 'PAGO' })

    expect(prisma.pagamento.findFirst).toHaveBeenCalledWith({
      where: {
        id: { not: 'pag-1' },
        membroId: 'membro-1',
        status: 'PENDENTE',
        dataVencimento: { gt: paidPagamento.dataVencimento },
      },
      orderBy: { dataVencimento: 'asc' },
    })

    expect(prisma.pagamento.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'pag-2' },
      data: { dataVencimento: expect.any(Date) },
    })

    const secondCallArgs = vi.mocked(prisma.pagamento.update).mock.calls[1][0] as { data: { dataVencimento: Date } }
    expect(secondCallArgs.data.dataVencimento.toISOString()).toContain('2026-02-28')
    expect(result).toEqual(paidPagamento)
  })

  it('updatePagamentoById does not sync when there is no next pending payment', async () => {
    vi.mocked(prisma.pagamento.findUnique).mockResolvedValueOnce({ id: 'pag-1', status: 'PENDENTE' })

    const paidPagamento = {
      id: 'pag-1',
      status: 'PAGO',
      membroId: 'membro-1',
      dataVencimento: new Date('2026-01-31T12:00:00.000Z'),
    }

    vi.mocked(prisma.pagamento.update).mockResolvedValueOnce(paidPagamento)
    vi.mocked(prisma.pagamento.findFirst).mockResolvedValueOnce(null)

    await updatePagamentoById('pag-1', { status: 'PAGO' })

    expect(prisma.pagamento.findFirst).toHaveBeenCalledTimes(1)
    expect(prisma.pagamento.update).toHaveBeenCalledTimes(1)
  })

  it('updatePagamentoById does not check for sync when status is not set to PAGO', async () => {
    vi.mocked(prisma.pagamento.findUnique).mockResolvedValueOnce({ id: 'pag-1', status: 'PAGO' })

    vi.mocked(prisma.pagamento.update).mockResolvedValueOnce({
      id: 'pag-1',
      status: 'PAGO',
      membroId: 'membro-1',
      dataVencimento: new Date('2026-01-31T12:00:00.000Z'),
    })

    await updatePagamentoById('pag-1', { observacao: 'nota' })

    expect(prisma.pagamento.findFirst).not.toHaveBeenCalled()
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
        data: { status: 'CANCELADO', dataPagamento: null },
      })
    )
    expect(result).toEqual({ id: 'pag-1', status: 'CANCELADO' })
  })
})
