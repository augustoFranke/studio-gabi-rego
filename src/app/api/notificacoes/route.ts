import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth } from '@/lib/api'
import { Prisma, TipoNotificacao } from '@prisma/client'
import { logError, safeErrorData } from '@/lib/observability/logger'
import { z } from 'zod'

const notificacaoSchema = z.object({
  membroId: z.string().min(1).nullable().optional(),
  tipo: z.nativeEnum(TipoNotificacao),
  titulo: z.string().trim().min(1).max(120),
  mensagem: z.string().trim().min(1).max(2000),
  canalEmail: z.boolean().optional(),
  agendadaPara: z.string().datetime().nullable().optional(),
})

export async function GET(request: NextRequest) {
  return withApiAuth(async (session) => {
    if (session.user.role === 'MEMBRO' && !session.user.membroId) {
      return NextResponse.json({ error: 'Perfil incompleto' }, { status: 403 })
    }

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

export async function POST(request: NextRequest) {
  return withApiAuth(async () => {
    try {
      let body: unknown
      try {
        body = await request.json()
      } catch {
        return NextResponse.json({ error: 'Dados inválidos enviados' }, { status: 400 })
      }

      const validation = notificacaoSchema.safeParse(body)

      if (!validation.success) {
        return NextResponse.json(
          { error: 'Campos obrigatórios: tipo, titulo, mensagem' },
          { status: 400 }
        )
      }

      const { membroId, tipo, titulo, mensagem, canalEmail, agendadaPara } = validation.data

      const notificacao = await prisma.notificacao.create({
        data: {
          membroId,
          tipo,
          titulo,
          mensagem,
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
      logError('notification_create_failed', {
        message: 'Erro ao criar notificação:',
        ...safeErrorData(error),
      })
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
    }
  }, { requiredRole: 'ADMIN' })
}
