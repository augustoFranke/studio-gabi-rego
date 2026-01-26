import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth } from '@/lib/api'

// GET /api/planos/[id] - Obter um plano específico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  const plano = await prisma.plano.findUnique({
    where: { id },
    include: {
      _count: {
        select: { membros: true, pagamentos: true }
      }
    }
  })

  if (!plano) {
    return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
  }

  return NextResponse.json(plano)
}

// PUT /api/planos/[id] - Atualizar plano (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(async () => {
    try {
      const { id } = await params
      const body = await request.json()
      const { nome, descricao, valor, duracaoDias, aulasSemanais, ativo } = body

      const plano = await prisma.plano.update({
        where: { id },
        data: {
          ...(nome !== undefined && { nome }),
          ...(descricao !== undefined && { descricao }),
          ...(valor !== undefined && { valor }),
          ...(duracaoDias !== undefined && { duracaoDias }),
          ...(aulasSemanais !== undefined && { aulasSemanais }),
          ...(ativo !== undefined && { ativo }),
        },
      })

      return NextResponse.json(plano)
    } catch (error) {
      console.error('Erro ao atualizar plano:', error)
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
    }
  }, { requiredRole: 'ADMIN' })
}

// DELETE /api/planos/[id] - Desativar plano (admin only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(async () => {
    try {
      const { id } = await params
      const membrosAtivos = await prisma.membro.count({
        where: { planoId: id, status: 'ATIVO' }
      })

      if (membrosAtivos > 0) {
        const plano = await prisma.plano.update({
          where: { id },
          data: { ativo: false },
        })
        return NextResponse.json({
          ...plano,
          message: `Plano desativado. ${membrosAtivos} membro(s) ativo(s) ainda usam este plano.`
        })
      }

      await prisma.plano.delete({ where: { id } })
      return NextResponse.json({ message: 'Plano removido com sucesso' })
    } catch (error) {
      console.error('Erro ao remover plano:', error)
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
    }
  }, { requiredRole: 'ADMIN' })
}
