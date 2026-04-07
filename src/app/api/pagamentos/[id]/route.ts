import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureOwnerOrAdmin, validateRequest, withApiAuth } from '@/lib/api'
import { StatusPagamento } from '@prisma/client'
import { z } from 'zod'
import {
  deletePagamentoById,
  getPagamentoById,
  PagamentoServiceError,
  updatePagamentoById,
} from '@/services/pagamento.service'

const pagamentoUpdateSchema = z.object({
  membroId: z.string().min(1).optional(),
  planoId: z.string().min(1).optional(),
  valor: z.number().positive().optional(),
  dataVencimento: z.string().min(1).optional(),
  formaPagamento: z.string().min(1).nullable().optional(),
  observacao: z.string().nullable().optional(),
  status: z.nativeEnum(StatusPagamento).optional(),
  dataPagamento: z.string().min(1).nullable().optional(),
  comprovante: z.string().nullable().optional(),
}).refine((data) => Object.values(data).some((value) => value !== undefined), {
  message: 'Nenhum dado para atualizar',
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(async (session) => {
    const { id } = await params
    const pagamento = await getPagamentoById(id)

    if (!pagamento) {
      return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 })
    }

    const authError = ensureOwnerOrAdmin(session, pagamento.membroId)
    if (authError) {
      return authError
    }

    return NextResponse.json(pagamento)
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(async () => {
    try {
      const { id } = await params
      const validation = await validateRequest(request, pagamentoUpdateSchema)

      if ('error' in validation) {
        return validation.error
      }

      const {
        membroId,
        planoId,
        valor,
        dataVencimento,
        formaPagamento,
        observacao,
        status,
        dataPagamento,
        comprovante,
      } = validation.data
      const pagamento = await updatePagamentoById(id, {
        membroId,
        planoId,
        valor,
        dataVencimento,
        formaPagamento,
        observacao,
        status,
        dataPagamento,
        comprovante,
      })

      const shouldSyncNextPendingBillingDate =
        pagamento.status === 'PAGO'
        && pagamento.membroId
        && (status === 'PAGO' || dataVencimento !== undefined)

      if (shouldSyncNextPendingBillingDate) {
        const billingDayOfMonth = pagamento.dataVencimento.getDate()

        const nextPendente = await prisma.pagamento.findFirst({
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

          await prisma.pagamento.update({
            where: { id: nextPendente.id },
            data: { dataVencimento: nextDate },
          })
        }
      }

      return NextResponse.json(pagamento)
    } catch (error) {
      if (error instanceof PagamentoServiceError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }

      console.error('Erro ao atualizar pagamento:', error)
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
    }
  }, { requiredRole: 'ADMIN' })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(async () => {
    try {
      const { id } = await params
      const result = await deletePagamentoById(id)

      if ('status' in result && result.status === 'CANCELADO') {
        return NextResponse.json({ ...result, message: 'Pagamento cancelado' })
      }

      return NextResponse.json({ message: 'Pagamento removido com sucesso' })
    } catch (error) {
      if (error instanceof PagamentoServiceError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }

      console.error('Erro ao remover pagamento:', error)
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
    }
  }, { requiredRole: 'ADMIN' })
}
