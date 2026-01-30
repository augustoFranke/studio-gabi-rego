export type Plano = {
  id: string
  nome: string
  descricao: string | null
  valor: string | number
  duracaoDias: number
  aulasSemanais: number
  ativo: boolean
  _count?: {
    membros: number
    pagamentos: number
  }
}

import type { StatusPagamento } from '@prisma/client'

export type PagamentoStatus = StatusPagamento

export type Pagamento = {
  id: string
  membroId: string
  planoId: string
  valor: string | number
  dataVencimento: string
  dataPagamento: string | null
  status: PagamentoStatus
  formaPagamento: string | null
  observacao: string | null
  membro: {
    usuario: {
      nome: string
    }
  }
  plano: {
    nome: string
  }
}

export type FinanceiroStats = {
  totalPlanos: number
  pagamentosPendentes: number
  pagamentosAtrasados: number
  receitaMes: number
}
