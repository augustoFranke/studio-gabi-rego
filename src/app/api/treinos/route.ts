import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth } from '@/lib/api'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

const exercicioSchema = z.object({
  sessao: z.string().default('A'),
  nome: z.string().optional(),
  grupoMuscular: z.string().optional(),
  series: z.number().optional(),
  repeticoes: z.string().optional(),
  carga: z.string().optional(),
  descanso: z.string().optional(),
  observacoes: z.string().optional(),
})

const fichaSchema = z.object({
  membroId: z.string().optional(),
  nome: z.string().optional(),
  data: z.string().optional(),
  objetivo: z.string().optional(),
  observacoes: z.string().optional(),
  exercicios: z.array(exercicioSchema).optional(),
})

// GET /api/treinos - Listar fichas de treino
export async function GET(request: NextRequest) {
  return withApiAuth(async (session) => {
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

    const fichas = await prisma.fichaTreino.findMany({
      where,
      include: {
        membro: {
          include: {
            usuario: {
              select: { nome: true },
            },
          },
        },
        exercicios: {
          orderBy: [{ sessao: 'asc' }, { ordem: 'asc' }],
        },
      },
      orderBy: { criadoEm: 'desc' },
    })

    return NextResponse.json(fichas)
  })
}

// POST /api/treinos - Criar nova ficha de treino (admin only)
export async function POST(request: NextRequest) {
  return withApiAuth(async () => {
    const body = await request.json()
    const validation = fichaSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { membroId, nome, data, objetivo, observacoes, exercicios } = validation.data

    // Desativar fichas anteriores do membro
    await prisma.fichaTreino.updateMany({
      where: { membroId, ativo: true },
      data: { ativo: false },
    })

    const ficha = await prisma.fichaTreino.create({
      data: {
        membroId,
        nome,
        data,
        objetivo,
        observacoes,
        exercicios: exercicios
          ? {
            create: exercicios.map(
              (ex, index: number) => ({
                sessao: ex.sessao,
                nome: ex.nome,
                grupoMuscular: ex.grupoMuscular,
                series: ex.series,
                repeticoes: ex.repeticoes,
                carga: ex.carga,
                descanso: ex.descanso,
                observacoes: ex.observacoes,
                ordem: index,
              })
            ),
          }
          : undefined,
      },
      include: {
        membro: {
          include: {
            usuario: {
              select: { nome: true },
            },
          },
        },
        exercicios: {
          orderBy: [{ sessao: 'asc' }, { ordem: 'asc' }],
        },
      },
    })

    return NextResponse.json(ficha, { status: 201 })
  }, { requiredRole: 'ADMIN' })
}
