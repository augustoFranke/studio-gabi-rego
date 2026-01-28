import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { NextResponse } from 'next/server'
import { GET } from '@/app/api/financeiro/stats/route'

const { prismaMock, sessionRef } = vi.hoisted(() => ({
  prismaMock: {
    plano: { count: vi.fn() },
    pagamento: { count: vi.fn(), aggregate: vi.fn() },
  },
  sessionRef: {
    current: { user: { role: 'ADMIN' as const } },
  } as { current: { user: { role: 'ADMIN' | 'MEMBRO' } } },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/api', () => ({
  withApiAuth: vi.fn(
    async (
      handler: (session: typeof sessionRef.current) => Promise<NextResponse>,
      options?: { requiredRole?: 'ADMIN' | 'MEMBRO'; requireAuth?: boolean }
    ) => {
      if (options?.requiredRole && sessionRef.current.user.role !== options.requiredRole) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
      }
      return handler(sessionRef.current)
    }
  ),
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
