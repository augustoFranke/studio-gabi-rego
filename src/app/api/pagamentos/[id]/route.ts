import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth } from '@/lib/api'
import { Prisma } from '@prisma/client'

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

    if (session.user.role === 'MEMBRO' && pagamento.membroId !== session.user.membroId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
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
      const body = await request.json()
      const { status, dataPagamento, formaPagamento, observacao, comprovante } = body

      const updateData: Prisma.PagamentoUpdateInput = {}

      if (status !== undefined) updateData.status = status
      if (formaPagamento !== undefined) updateData.formaPagamento = formaPagamento
      if (observacao !== undefined) updateData.observacao = observacao
      if (comprovante !== undefined) updateData.comprovante = comprovante

      if (status === 'PAGO') {
        updateData.dataPagamento = dataPagamento ? new Date(dataPagamento) : new Date()
      } else if (status === 'PENDENTE' || status === 'CANCELADO') {
        updateData.dataPagamento = null
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
