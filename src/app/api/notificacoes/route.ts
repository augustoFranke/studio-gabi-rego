import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth } from '@/lib/api'
import { Prisma } from '@prisma/client'

// GET /api/notificacoes - Listar notificações
export async function GET(request: NextRequest) {
  return withApiAuth(async (session) => {
    const searchParams = request.nextUrl.searchParams
    const membroId = searchParams.get('membroId')
    const enviada = searchParams.get('enviada')

    const where: Prisma.NotificacaoWhereInput = {}

    if (session.user.role === 'MEMBRO' && session.user.membroId) {
      where.membroId = session.user.membroId
    } else if (membroId) {
      where.membroId = membroId
    }

    if (enviada !== null) {
      where.enviada = enviada === 'true'
    }

    const notificacoes = await prisma.notificacao.findMany({
      where,
      include: {
        membro: {
          include: {
            usuario: {
              select: { nome: true },
            },
          },
        },
      },
      orderBy: { criadoEm: 'desc' },
      take: 100,
    })

    return NextResponse.json(notificacoes)
  })
}

// POST /api/notificacoes - Criar notificação manual (admin only)
export async function POST(request: NextRequest) {
  return withApiAuth(async () => {
    try {
      const body = await request.json()
      const { membroId, tipo, titulo, mensagem, canalWhatsapp, canalEmail, agendadaPara } = body

      if (!tipo || !titulo || !mensagem) {
        return NextResponse.json(
          { error: 'Campos obrigatórios: tipo, titulo, mensagem' },
          { status: 400 }
        )
      }

      const notificacao = await prisma.notificacao.create({
        data: {
          membroId,
          tipo,
          titulo,
          mensagem,
          canalWhatsapp: canalWhatsapp ?? false,
          canalEmail: canalEmail ?? false,
          agendadaPara: agendadaPara ? new Date(agendadaPara) : null,
        },
        include: {
          membro: {
            include: {
              usuario: {
                select: { nome: true },
              },
            },
          },
        },
      })

      return NextResponse.json(notificacao, { status: 201 })
    } catch (error) {
      console.error('Erro ao criar notificação:', error)
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
    }
  }, { requiredRole: 'ADMIN' })
}
