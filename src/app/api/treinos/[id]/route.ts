import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth } from '@/lib/api'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

const exercicioSchema = z.object({
  id: z.string().optional(),
  sessao: z.string().default('A'),
  nome: z.string().optional(),
  grupoMuscular: z.string().optional(),
  series: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  repeticoes: z.string().optional(),
  descanso: z.string().optional(),
  observacoes: z.string().optional(),
})

const updateFichaSchema = z.object({
  nome: z.string().optional(),
  data: z.string().optional(),
  objetivo: z.string().optional(),
  observacoes: z.string().optional(),
  exercicios: z.array(exercicioSchema).optional(),
})

const fichaSelect = {
  id: true,
  nome: true,
  data: true,
  objetivo: true,
  observacoes: true,
  membroId: true,
  membro: {
    select: {
      id: true,
      usuario: {
        select: { nome: true },
      },
    },
  },
  exercicios: {
    select: {
      id: true,
      sessao: true,
      nome: true,
      series: true,
      repeticoes: true,
    },
    orderBy: [{ sessao: 'asc' }, { ordem: 'asc' }],
  },
} satisfies Prisma.FichaTreinoSelect

// GET /api/treinos/[id] - Get a single training plan
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withApiAuth(async (session) => {
    const { id } = await params

    const ficha = await prisma.fichaTreino.findUnique({
      where: { id },
      select: fichaSelect,
    })

    if (!ficha) {
      return NextResponse.json({ error: 'Ficha não encontrada' }, { status: 404 })
    }

    // If member, can only see their own training
    if (session.user.role === 'MEMBRO' && ficha.membroId !== session.user.membroId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    return NextResponse.json(ficha)
  })
}

// PUT /api/treinos/[id] - Update a training plan (admin only)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withApiAuth(async () => {
    const { id } = await params
    const body = await request.json()
    const validation = updateFichaSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { nome, data, objetivo, observacoes, exercicios } = validation.data

    // Check if training exists
    const existingFicha = await prisma.fichaTreino.findUnique({
      where: { id },
    })

    if (!existingFicha) {
      return NextResponse.json({ error: 'Ficha não encontrada' }, { status: 404 })
    }

    // Update the training plan
    const updateData: {
      nome?: string
      data?: string
      objetivo?: string
      observacoes?: string
    } = {}

    if (nome !== undefined) updateData.nome = nome
    if (data !== undefined) updateData.data = data
    if (objetivo !== undefined) updateData.objetivo = objetivo
    if (observacoes !== undefined) updateData.observacoes = observacoes

    // If exercises are provided, delete old ones and create new
    if (exercicios !== undefined) {
      await prisma.exercicio.deleteMany({
        where: { fichaId: id },
      })

      await prisma.exercicio.createMany({
        data: exercicios.map((ex, index) => ({
          fichaId: id,
          sessao: ex.sessao,
          nome: ex.nome || 'Exercício',
          grupoMuscular: ex.grupoMuscular,
          series: ex.series || '3',
          repeticoes: ex.repeticoes || '10',
          descanso: ex.descanso,
          observacoes: ex.observacoes,
          ordem: index,
        })),
      })
    }

    const ficha = await prisma.fichaTreino.update({
      where: { id },
      data: updateData,
      select: fichaSelect,
    })

    return NextResponse.json(ficha)
  }, { requiredRole: 'ADMIN' })
}

// DELETE /api/treinos/[id] - Delete a training plan (admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withApiAuth(async () => {
    const { id } = await params

    // Check if training exists
    const existingFicha = await prisma.fichaTreino.findUnique({
      where: { id },
    })

    if (!existingFicha) {
      return NextResponse.json({ error: 'Ficha não encontrada' }, { status: 404 })
    }

    await prisma.fichaTreino.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  }, { requiredRole: 'ADMIN' })
}
