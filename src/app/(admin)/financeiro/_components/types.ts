import type { Prisma } from '@prisma/client'

export type FinanceiroStats = {
  totalPlanos: number
  pagamentosPendentes: number
  pagamentosAtrasados: number
  receitaMes: number
}

export type Plano = Omit<
  Prisma.PlanoGetPayload<{
    include: { _count: { select: { membros: true; pagamentos: true } } }
  }>,
  'valor'
> & {
  valor: string | number
}

export type Pagamento = Omit<
  Prisma.PagamentoGetPayload<{
    include: {
      membro: { include: { usuario: { select: { nome: true } } } }
      plano: true
    }
  }>,
  'valor' | 'dataVencimento' | 'dataPagamento'
> & {
  valor: string | number
  dataVencimento: string
  dataPagamento: string | null
}

export type Membro = Omit<
  Prisma.MembroGetPayload<{
    include: {
      usuario: { select: { id: true; nome: true; email: true } }
      plano: true
    }
  }>,
  'dataNascimento' | 'precoCustomizado'
> & {
  dataNascimento?: string | Date | null
  precoCustomizado?: string | number | null
}
