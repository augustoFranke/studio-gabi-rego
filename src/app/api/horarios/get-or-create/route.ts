import { NextRequest, NextResponse } from 'next/server'
import { validateRequest, withApiAuth } from '@/lib/api'
import { DiaSemana } from '@prisma/client'
import { z } from 'zod'
import { getOrCreateHorario } from '@/services/horario.service'

const getOrCreateSchema = z.object({
  diaSemana: z.nativeEnum(DiaSemana),
  horaInicio: z.string().regex(/^([01]\d|2[0-3]):00$/, 'Informe uma hora cheia válida'),
})

export async function POST(request: NextRequest) {
  return withApiAuth(async () => {
    const validation = await validateRequest(request, getOrCreateSchema, {
      errorMessage: () => 'Campos obrigatorios: diaSemana, horaInicio',
    })

    if ('error' in validation) {
      return validation.error
    }

    const horario = await getOrCreateHorario(validation.data)
    return NextResponse.json(horario)
  }, { requiredRole: 'ADMIN' })
}
