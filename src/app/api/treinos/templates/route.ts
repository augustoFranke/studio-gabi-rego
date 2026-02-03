import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth, validateRequest } from '@/lib/api'
import { treinoTemplateSchema } from '@/schemas/treino.schema'
import {
  createTreinoTemplate,
  getFichaTreinoWithDetails,
  listTreinoTemplates,
} from '@/services/treino.service'

// GET /api/treinos/templates - Listar templates de treino
export async function GET() {
  return withApiAuth(async () => {
    const templates = await listTreinoTemplates()

    return NextResponse.json(templates)
  }, { requiredRole: 'ADMIN' })
}

// POST /api/treinos/templates - Criar template de treino (admin only)
export async function POST(request: NextRequest) {
  return withApiAuth(async () => {
    const validation = await validateRequest(request, treinoTemplateSchema)

    if ('error' in validation) {
      return validation.error
    }

    const { nome, objetivo, observacoes, fichaId, exercicios } = validation.data

    let sourceExercises = exercicios
    let sourceObjetivo = objetivo
    let sourceObservacoes = observacoes

    if (fichaId) {
      const ficha = await getFichaTreinoWithDetails(fichaId)

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

    const template = await createTreinoTemplate({
      nome,
      objetivo: sourceObjetivo,
      observacoes: sourceObservacoes,
      exercicios: sourceExercises,
    })

    return NextResponse.json(template, { status: 201 })
  }, { requiredRole: 'ADMIN' })
}
