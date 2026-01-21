import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth } from '@/lib/api'
import { z } from 'zod'

const exercicioSchema = z.object({
  sessao: z.string().default('A'),
  nome: z.string().optional(),
  grupoMuscular: z.string().optional(),
  series: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  repeticoes: z.string().optional(),
  descanso: z.string().optional(),
  observacoes: z.string().optional(),
})

const templateSchema = z.object({
  nome: z.string().min(1),
  objetivo: z.string().optional(),
  observacoes: z.string().optional(),
  fichaId: z.string().optional(),
  exercicios: z.array(exercicioSchema).optional(),
})

// GET /api/treinos/templates - Listar templates de treino
export async function GET() {
  return withApiAuth(async () => {
    const templates = await prisma.treinoTemplate.findMany({
      include: {
        exercicios: {
          orderBy: [{ sessao: 'asc' }, { ordem: 'asc' }],
        },
      },
      orderBy: { criadoEm: 'desc' },
    })

    return NextResponse.json(templates)
  }, { requiredRole: 'ADMIN' })
}

// POST /api/treinos/templates - Criar template de treino (admin only)
export async function POST(request: NextRequest) {
  return withApiAuth(async () => {
    const body = await request.json()
    const validation = templateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { nome, objetivo, observacoes, fichaId, exercicios } = validation.data

    let sourceExercises = exercicios
    let sourceObjetivo = objetivo
    let sourceObservacoes = observacoes

    if (fichaId) {
      const ficha = await prisma.fichaTreino.findUnique({
        where: { id: fichaId },
        include: {
          exercicios: {
            orderBy: [{ sessao: 'asc' }, { ordem: 'asc' }],
          },
        },
      })

      if (!ficha) {
        return NextResponse.json({ error: 'Treino não encontrado' }, { status: 404 })
      }

      sourceExercises = ficha.exercicios.map((ex) => ({
        sessao: ex.sessao,
        nome: ex.nome,
        grupoMuscular: ex.grupoMuscular ?? undefined,
        series: ex.series,
        repeticoes: ex.repeticoes,
        descanso: ex.descanso ?? undefined,
        observacoes: ex.observacoes ?? undefined,
      }))

      if (sourceObjetivo === undefined) {
        sourceObjetivo = ficha.objetivo ?? undefined
      }
      if (sourceObservacoes === undefined) {
        sourceObservacoes = ficha.observacoes ?? undefined
      }
    }

    if (!sourceExercises || sourceExercises.length === 0) {
      return NextResponse.json(
        { error: 'Informe exercícios para criar o template' },
        { status: 400 }
      )
    }

    const template = await prisma.treinoTemplate.create({
      data: {
        nome,
        objetivo: sourceObjetivo,
        observacoes: sourceObservacoes,
        exercicios: {
          create: sourceExercises.map((ex, index) => ({
            sessao: ex.sessao,
            nome: ex.nome || 'Exercício',
            grupoMuscular: ex.grupoMuscular,
            series: ex.series || '3',
            repeticoes: ex.repeticoes || '10',
            descanso: ex.descanso,
            observacoes: ex.observacoes,
            ordem: index,
          })),
        },
      },
      include: {
        exercicios: {
          orderBy: [{ sessao: 'asc' }, { ordem: 'asc' }],
        },
      },
    })

    return NextResponse.json(template, { status: 201 })
  }, { requiredRole: 'ADMIN' })
}
