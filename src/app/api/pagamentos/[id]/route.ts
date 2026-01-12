import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

// GET /api/pagamentos/[id] - Obter um pagamento específico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params

  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

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

  // Se for membro, só pode ver seus próprios pagamentos
  if (session.user.role === 'MEMBRO' && pagamento.membroId !== session.user.membroId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  return NextResponse.json(pagamento)
}

// PUT /api/pagamentos/[id] - Atualizar pagamento (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { status, dataPagamento, formaPagamento, observacao, comprovante } = body

    const updateData: Record<string, unknown> = {}

    if (status !== undefined) updateData.status = status
    if (formaPagamento !== undefined) updateData.formaPagamento = formaPagamento
    if (observacao !== undefined) updateData.observacao = observacao
    if (comprovante !== undefined) updateData.comprovante = comprovante

    // Se marcou como pago e não tem data de pagamento, usar data atual
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
}

// DELETE /api/pagamentos/[id] - Cancelar pagamento (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const pagamento = await prisma.pagamento.findUnique({ where: { id } })

    if (!pagamento) {
      return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 })
    }

    // Se já foi pago, apenas cancelar
    if (pagamento.status === 'PAGO') {
      const updated = await prisma.pagamento.update({
        where: { id },
        data: { status: 'CANCELADO' }
      })
      return NextResponse.json({ ...updated, message: 'Pagamento cancelado' })
    }

    // Se pendente ou atrasado, pode deletar
    await prisma.pagamento.delete({ where: { id } })
    return NextResponse.json({ message: 'Pagamento removido com sucesso' })
  } catch (error) {
    console.error('Erro ao remover pagamento:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

