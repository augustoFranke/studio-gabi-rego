import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureOwnerOrAdmin, validateRequest, withApiAuth } from '@/lib/api'
import { parseLocalDate } from '@/lib/schedule'
import { Prisma, StatusPagamento } from '@prisma/client'
import { z } from 'zod'

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

// GET /api/pagamentos/[id] - Obter um pagamento específico
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(async (session) => {
    const { id } = await params
    const pagamento = await prisma.pagamento.findUnique({
      where: { id },
      include: {
        membro: {
          include: {
            usuario: {
              select: { nome: true, email: true }
            }
          }
        },
        plano: true
      }
    })

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

// PUT /api/pagamentos/[id] - Atualizar pagamento (admin only)
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

      const updateData: Prisma.PagamentoUpdateInput = {}

      if (membroId !== undefined) updateData.membro = { connect: { id: membroId } }
      if (planoId !== undefined) updateData.plano = { connect: { id: planoId } }
      if (valor !== undefined) updateData.valor = valor
      if (dataVencimento !== undefined) updateData.dataVencimento = parseLocalDate(dataVencimento)
      if (status !== undefined) updateData.status = status
      if (formaPagamento !== undefined) updateData.formaPagamento = formaPagamento
      if (observacao !== undefined) updateData.observacao = observacao
      if (comprovante !== undefined) updateData.comprovante = comprovante

      if (status === 'PAGO') {
        updateData.dataPagamento = new Date()
      } else if (status === 'PENDENTE' || status === 'CANCELADO') {
        updateData.dataPagamento = null
      }

      if (dataPagamento !== undefined) {
        updateData.dataPagamento = dataPagamento ? new Date(dataPagamento) : null
      }

      const pagamento = await prisma.pagamento.update({
        where: { id },
        data: updateData,
        include: {
          membro: {
            include: {
              usuario: {
                select: { nome: true }
              }
            }
          },
          plano: true
        }
      })

      return NextResponse.json(pagamento)
    } catch (error) {
      console.error('Erro ao atualizar pagamento:', error)
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
    }
  }, { requiredRole: 'ADMIN' })
}

// DELETE /api/pagamentos/[id] - Cancelar pagamento (admin only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(async () => {
    try {
      const { id } = await params
      const pagamento = await prisma.pagamento.findUnique({ where: { id } })

      if (!pagamento) {
        return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 })
      }

      if (pagamento.status === 'PAGO') {
        const updated = await prisma.pagamento.update({
          where: { id },
          data: { status: 'CANCELADO' }
        })
        return NextResponse.json({ ...updated, message: 'Pagamento cancelado' })
      }

      await prisma.pagamento.delete({ where: { id } })
      return NextResponse.json({ message: 'Pagamento removido com sucesso' })
    } catch (error) {
      console.error('Erro ao remover pagamento:', error)
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
    }
  }, { requiredRole: 'ADMIN' })
}
