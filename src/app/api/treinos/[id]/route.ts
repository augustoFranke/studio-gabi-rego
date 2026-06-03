import { NextRequest, NextResponse } from 'next/server'
import { ensureOwnerOrAdmin, withApiAuth, validateRequest } from '@/lib/api'
import { fichaUpdateSchema } from '@/schemas/treino.schema'
import {
  deleteFichaTreino,
  getFichaTreinoById,
  updateFichaTreinoWithExercises,
} from '@/services/treino.service'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}


// GET /api/treinos/[id] - Get a single training plan
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withApiAuth(async (session) => {
    const { id } = await params

    const ficha = await getFichaTreinoById(id)

    if (!ficha) {
      return NextResponse.json({ error: 'Ficha não encontrada' }, { status: 404 })
    }

    const authError = ensureOwnerOrAdmin(session, ficha.membroId, { status: 401 })
    if (authError) {
      return authError
    }

    return NextResponse.json(ficha)
  })
}

// PUT /api/treinos/[id] - Update a training plan (admin only)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withApiAuth(async () => {
    const [{ id }, validation] = await Promise.all([
      params,
      validateRequest(request, fichaUpdateSchema),
    ])

    if ('error' in validation) {
      return validation.error
    }

    const { nome, data, objetivo, observacoes, exercicios } = validation.data

    // Check if training exists
    const existingFicha = await getFichaTreinoById(id)

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

    const ficha = await updateFichaTreinoWithExercises(id, updateData, exercicios)

    return NextResponse.json(ficha)
  }, { requiredRole: 'ADMIN' })
}

// DELETE /api/treinos/[id] - Delete a training plan (admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withApiAuth(async () => {
    const { id } = await params

    // Check if training exists
    const existingFicha = await getFichaTreinoById(id)

    if (!existingFicha) {
      return NextResponse.json({ error: 'Ficha não encontrada' }, { status: 404 })
    }

    await deleteFichaTreino(id)

    return NextResponse.json({ success: true })
  }, { requiredRole: 'ADMIN' })
}
