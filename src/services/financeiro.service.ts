import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export type FinanceiroStats = {
  totalPlanos: number
  pagamentosPendentes: number
  pagamentosAtrasados: number
  receitaMes: Prisma.Decimal | number
}

export async function getFinanceiroStats(): Promise<FinanceiroStats> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  endOfMonth.setHours(23, 59, 59, 999)

  const [
    totalPlanos,
    pagamentosPendentes,
    pagamentosAtrasados,
    receitaMesResult
  ] = await Promise.all([
    prisma.plano.count({ where: { ativo: true } }),
    prisma.pagamento.count({ where: { status: 'PENDENTE' } }),
    prisma.pagamento.count({ where: { status: 'ATRASADO' } }),
    prisma.pagamento.aggregate({
      _sum: { valor: true },
      where: {
        status: 'PAGO',
        dataPagamento: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      }
    })
  ])

  return {
    totalPlanos,
    pagamentosPendentes,
    pagamentosAtrasados,
    receitaMes: receitaMesResult._sum.valor || 0
  }
}
