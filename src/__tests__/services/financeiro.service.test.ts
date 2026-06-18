import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFinanceiroStats } from '@/services/financeiro.service'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    plano: { count: vi.fn() },
    pagamento: { count: vi.fn(), aggregate: vi.fn() },
  },
}))

describe('financeiro.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the four stats numbers from seeded data', async () => {
    vi.mocked(prisma.plano.count).mockResolvedValueOnce(5)
    vi.mocked(prisma.pagamento.count)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
    vi.mocked(prisma.pagamento.aggregate).mockResolvedValueOnce({
      _sum: { valor: 1500 },
    } as never)

    const stats = await getFinanceiroStats()

    expect(stats).toEqual({
      totalPlanos: 5,
      pagamentosPendentes: 2,
      pagamentosAtrasados: 1,
      receitaMes: 1500,
    })
  })

  it('defaults receitaMes to 0 when the aggregate sum is null', async () => {
    vi.mocked(prisma.plano.count).mockResolvedValueOnce(0)
    vi.mocked(prisma.pagamento.count)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
    vi.mocked(prisma.pagamento.aggregate).mockResolvedValueOnce({
      _sum: { valor: null },
    } as never)

    const stats = await getFinanceiroStats()

    expect(stats.receitaMes).toBe(0)
  })
})
