import { NextRequest, NextResponse } from 'next/server'
import { validateRequest, withApiAuth } from '@/lib/api'
import { DiaSemana } from '@prisma/client'
import { z } from 'zod'
import { getOrCreateHorario, HorarioServiceError } from '@/services/horario.service'
import { logError, safeErrorData } from '@/lib/observability/logger'
import { HORARIO_GET_OR_CREATE_FAILED } from '@/lib/observability/events'

const getOrCreateSchema = z.object({
  diaSemana: z.nativeEnum(DiaSemana),
  horaInicio: z.string().regex(/^([01]\d|2[0-3]):00$/, 'Informe uma hora cheia válida'),
})

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

      logError(HORARIO_GET_OR_CREATE_FAILED, {
        message: 'Erro ao obter/criar horario:',
        ...safeErrorData(error),
      })
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
    }
  }, { requiredRole: 'ADMIN' })
}
