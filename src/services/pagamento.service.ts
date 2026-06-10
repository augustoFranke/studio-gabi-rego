import { prisma } from '@/lib/prisma'
import { parseLocalDate } from '@/lib/schedule'
import { Prisma, StatusPagamento } from '@prisma/client'

export class PagamentoServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message)
    this.name = 'PagamentoServiceError'
  }
}

const pagamentoInclude = {
  membro: {
    include: {
      usuario: {
        select: { nome: true, email: true },
      },
    },
  },
  plano: true,
} satisfies Prisma.PagamentoInclude

export type PagamentoListParams = {
  sessionRole: 'ADMIN' | 'MEMBRO'
  sessionMembroId?: string
  membroId?: string | null
  status?: string | null
  search?: string | null
  sort?: string | null
  page?: number
  limit?: number
}

export type PagamentoCreateInput = {
  membroId: string
  planoId: string
  valor: number
  dataVencimento: string
  formaPagamento: string
  observacao?: string | null
}

export async function getPagamentoById(id: string) {
  return prisma.pagamento.findUnique({
    where: { id },
    include: pagamentoInclude,
  })
}

export async function listPagamentos(params: PagamentoListParams) {
  const {
    sessionRole,
    sessionMembroId,
    membroId,
    status,
    search,
    sort = 'recent_desc',
    page = 1,
    limit = 10,
  } = params

  if (sessionRole === 'MEMBRO' && !sessionMembroId) {
    throw new PagamentoServiceError('Perfil incompleto', 'PROFILE_INCOMPLETE', 403)
  }

  const where: Prisma.PagamentoWhereInput = {}

  if (sessionRole === 'MEMBRO' && sessionMembroId) {
    where.membroId = sessionMembroId
  } else if (membroId) {
    where.membroId = membroId
  }

  if (status && status !== 'all') {
    where.status = status as StatusPagamento
  }

  if (search) {
    where.OR = [
      {
        membro: {
          usuario: {
            nome: { contains: search, mode: 'insensitive' },
          },
        },
      },
      { payerNome: { contains: search, mode: 'insensitive' } },
    ]
  }

  const orderBy: Prisma.PagamentoOrderByWithRelationInput =
    sort === 'recent_desc'
      ? { criadoEm: 'desc' }
      : sort === 'vencimento_asc'
        ? { dataVencimento: 'asc' }
        : { dataVencimento: 'desc' }

  const skip = (page - 1) * limit

  const [total, pagamentos] = await Promise.all([
    prisma.pagamento.count({ where }),
    prisma.pagamento.findMany({
      where,
      include: pagamentoInclude,
      orderBy,
      skip,
      take: limit,
    }),
  ])

  return {
    data: pagamentos,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export async function createPagamento(input: PagamentoCreateInput) {
  return prisma.pagamento.create({
    data: {
      membroId: input.membroId,
      planoId: input.planoId,
      valor: input.valor,
      dataVencimento: parseLocalDate(input.dataVencimento),
      formaPagamento: input.formaPagamento,
      observacao: input.observacao,
    },
    include: pagamentoInclude,
  })
}

export async function updatePagamentoById(
  id: string,
  data: {
    membroId?: string
    planoId?: string
    valor?: number
    dataVencimento?: string
    formaPagamento?: string | null
    observacao?: string | null
    status?: StatusPagamento
    dataPagamento?: string | null
    comprovante?: string | null
  }
) {
  const pagamentoExistente = await prisma.pagamento.findUnique({ where: { id } })

  if (!pagamentoExistente) {
    throw new PagamentoServiceError('Pagamento não encontrado', 'PAGAMENTO_NOT_FOUND', 404)
  }

  const updateData: Prisma.PagamentoUpdateInput = {}

  if (data.membroId !== undefined) updateData.membro = { connect: { id: data.membroId } }
  if (data.planoId !== undefined) updateData.plano = { connect: { id: data.planoId } }
  if (data.valor !== undefined) updateData.valor = data.valor
  if (data.dataVencimento !== undefined) updateData.dataVencimento = parseLocalDate(data.dataVencimento)
  if (data.status !== undefined) updateData.status = data.status
  if (data.formaPagamento !== undefined) updateData.formaPagamento = data.formaPagamento
  if (data.observacao !== undefined) updateData.observacao = data.observacao
  if (data.comprovante !== undefined) updateData.comprovante = data.comprovante

  if (data.status === 'PAGO') {
    updateData.dataPagamento = new Date()
  } else if (data.status === 'PENDENTE' || data.status === 'CANCELADO') {
    updateData.dataPagamento = null
  }

  if (data.dataPagamento !== undefined) {
    updateData.dataPagamento = data.dataPagamento ? new Date(data.dataPagamento) : null
  }

  return prisma.$transaction(async (tx) => {
    const pagamento = await tx.pagamento.update({ where: { id }, data: updateData, include: pagamentoInclude })

    const shouldSyncNextPendingBillingDate =
      pagamento.status === 'PAGO'
      && pagamento.membroId
      && (data.status === 'PAGO' || data.dataVencimento !== undefined)

    if (shouldSyncNextPendingBillingDate) {
      const billingDayOfMonth = pagamento.dataVencimento.getDate()
      const nextPendente = await tx.pagamento.findFirst({
        where: {
          id: { not: id },
          membroId: pagamento.membroId,
          status: 'PENDENTE',
          dataVencimento: { gt: pagamento.dataVencimento },
        },
        orderBy: { dataVencimento: 'asc' },
      })

      if (nextPendente) {
        const nextDate = new Date(nextPendente.dataVencimento)
        const maxDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()
        nextDate.setDate(Math.min(billingDayOfMonth, maxDay))
        await tx.pagamento.update({ where: { id: nextPendente.id }, data: { dataVencimento: nextDate } })
      }
    }

    return pagamento
  })
}

export async function deletePagamentoById(id: string) {
  const pagamento = await prisma.pagamento.findUnique({ where: { id } })

  if (!pagamento) {
    throw new PagamentoServiceError('Pagamento não encontrado', 'PAGAMENTO_NOT_FOUND', 404)
  }

  return prisma.pagamento.update({
    where: { id },
    data: { status: 'CANCELADO', dataPagamento: null },
  })
}
