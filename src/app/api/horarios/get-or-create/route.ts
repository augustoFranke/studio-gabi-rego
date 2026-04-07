import { NextRequest, NextResponse } from 'next/server'
import { validateRequest, withApiAuth } from '@/lib/api'
import { DiaSemana } from '@prisma/client'
import { z } from 'zod'
import { getOrCreateHorario, HorarioServiceError } from '@/services/horario.service'

const getOrCreateSchema = z.object({
  diaSemana: z.nativeEnum(DiaSemana),
  horaInicio: z.string().min(1, 'Informe a hora de início'),
})

// POST /api/horarios/get-or-create - Get existing or create new horario
export async function POST(request: NextRequest) {
  return withApiAuth(async () => {
    try {
      const validation = await validateRequest(request, getOrCreateSchema, {
        errorMessage: () => 'Campos obrigatorios: diaSemana, horaInicio',
      })

      if ('error' in validation) {
        return validation.error
      }

      const horario = await getOrCreateHorario(validation.data)
      return NextResponse.json(horario)
    } catch (error) {
      if (error instanceof HorarioServiceError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }

      console.error('Erro ao obter/criar horario:', error)
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
    }
  }, { requiredRole: 'ADMIN' })
}
