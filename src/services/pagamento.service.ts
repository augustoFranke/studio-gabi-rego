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

export async function getPagamentoById(id: string) {
  return prisma.pagamento.findUnique({
    where: { id },
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

  return prisma.pagamento.update({
    where: { id },
    data: updateData,
    include: pagamentoInclude,
  })
}

export async function deletePagamentoById(id: string) {
  const pagamento = await prisma.pagamento.findUnique({ where: { id } })

  if (!pagamento) {
    throw new PagamentoServiceError('Pagamento não encontrado', 'PAGAMENTO_NOT_FOUND', 404)
  }

  if (pagamento.status === 'PAGO') {
    return prisma.pagamento.update({
      where: { id },
      data: { status: 'CANCELADO' },
    })
  }

  return prisma.pagamento.delete({ where: { id } })
}
