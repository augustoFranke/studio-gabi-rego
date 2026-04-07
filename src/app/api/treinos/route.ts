import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth, validateRequest } from '@/lib/api'
import { Prisma } from '@prisma/client'
import { fichaCreateSchema } from '@/schemas/treino.schema'
import {
  createFichaTreino,
  deactivateActiveFichas,
  listFichasTreino,
} from '@/services/treino.service'

// GET /api/treinos - Listar fichas de treino
export async function GET(request: NextRequest) {
  return withApiAuth(async (session) => {
    if (session.user.role === 'MEMBRO' && !session.user.membroId) {
      return NextResponse.json({ error: 'Perfil incompleto' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const membroId = searchParams.get('membroId')
    const apenasAtivos = searchParams.get('ativos') !== 'false'

    const where: Prisma.FichaTreinoWhereInput = {}

    // Se for membro, só pode ver seu próprio treino
    if (session.user.role === 'MEMBRO' && session.user.membroId) {
      where.membroId = session.user.membroId
    } else if (membroId) {
      where.membroId = membroId
    }

    if (apenasAtivos) {
      where.ativo = true
    }

    const fichas = await listFichasTreino(where)

    return NextResponse.json(fichas)
  })
}

// POST /api/treinos - Criar nova ficha de treino (admin only)
export async function POST(request: NextRequest) {
  return withApiAuth(async () => {
    const validation = await validateRequest(request, fichaCreateSchema)

    if ('error' in validation) {
      return validation.error
    }

    const { membroId, nome, data, objetivo, observacoes, exercicios } = validation.data

    if (!membroId) {
      return NextResponse.json({ error: 'membroId é obrigatório' }, { status: 400 })
    }

    // Desativar fichas anteriores do membro (only if membroId provided)
    await deactivateActiveFichas(membroId)

    const ficha = await createFichaTreino({
      membroId,
      nome,
      data,
      objetivo,
      observacoes,
      exercicios,
    })

    return NextResponse.json(ficha, { status: 201 })
  }, { requiredRole: 'ADMIN' })
}
