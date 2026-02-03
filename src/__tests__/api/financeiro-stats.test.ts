import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { GET } from '@/app/api/financeiro/stats/route'

const { prismaMock, sessionRef, withApiAuthMock } = vi.hoisted(() => {
  const { createPrismaMock, createSessionRef, mockWithApiAuth } = globalThis.__testUtils
  const sessionRef = createSessionRef({ user: { role: 'ADMIN' } })
  return {
    prismaMock: createPrismaMock({
      plano: ['count'],
      pagamento: ['count', 'aggregate'],
    }),
    sessionRef,
    withApiAuthMock: mockWithApiAuth(sessionRef).withApiAuth,
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/api', () => ({
  withApiAuth: withApiAuthMock,
}))

describe('Financeiro Stats API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'))
    sessionRef.current = { user: { role: 'ADMIN' } }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns stats and defaults receitaMes to 0 when null', async () => {
    prismaMock.plano.count.mockResolvedValueOnce(5)
    prismaMock.pagamento.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
    prismaMock.pagamento.aggregate.mockResolvedValueOnce({ _sum: { valor: null } })

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({
      totalPlanos: 5,
      pagamentosPendentes: 2,
      pagamentosAtrasados: 1,
      receitaMes: 0,
    })
    expect(prismaMock.pagamento.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'PAGO' }),
      })
    )
  })
})
