import { NextRequest, NextResponse } from 'next/server'
import { validateRequest, withApiAuth } from '@/lib/api'
import { DiaSemana } from '@prisma/client'
import { z } from 'zod'
import { MAX_CAPACITY_PER_SLOT } from '@/lib/schedule'
import { createHorario, HorarioServiceError, listHorarios } from '@/services/horario.service'

const hourSchema = z.string().regex(/^([01]\d|2[0-3]):00$/, 'Informe uma hora cheia válida')

const horarioSchema = z.object({
  diaSemana: z.nativeEnum(DiaSemana),
  horaInicio: hourSchema,
  horaFim: hourSchema,
  vagasTotal: z.number().int().min(1, 'Informe a quantidade de vagas').max(MAX_CAPACITY_PER_SLOT),
})

export async function GET(request: NextRequest) {
  return withApiAuth(async () => {
    const searchParams = request.nextUrl.searchParams
    const diaSemana = searchParams.get('diaSemana') as DiaSemana | null
    const ativo = searchParams.get('ativo')

    const horarios = await listHorarios({
      diaSemana,
      ativo: ativo === null ? null : ativo === 'true',
    })

    return NextResponse.json(horarios)
  })
}

export async function POST(request: NextRequest) {
  return withApiAuth(async () => {
    try {
      const validation = await validateRequest(request, horarioSchema, {
        errorMessage: () => 'Campos obrigatorios: diaSemana, horaInicio, horaFim, vagasTotal',
      })

      if ('error' in validation) {
        return validation.error
      }

      const horario = await createHorario(validation.data)
      return NextResponse.json(horario, { status: 201 })
    } catch (error) {
      if (error instanceof HorarioServiceError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }

      console.error('Erro ao criar horario:', error)
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
    }
  }, { requiredRole: 'ADMIN' })
}
