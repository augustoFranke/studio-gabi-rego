import { NextRequest, NextResponse } from 'next/server'
import { validateRequest, withApiAuth } from '@/lib/api'
import { DiaSemana } from '@prisma/client'
import { z } from 'zod'
import { buildScheduleEndTime, isSchedulableHourString, MAX_CAPACITY_PER_SLOT } from '@/lib/schedule'
import { createHorario, listHorarios } from '@/services/horario.service'

const hourSchema = z.string().refine(isSchedulableHourString, 'Informe uma hora cheia dentro da grade')

const horarioSchema = z.object({
  diaSemana: z.nativeEnum(DiaSemana),
  horaInicio: hourSchema,
  horaFim: hourSchema,
  vagasTotal: z.number().int().min(1, 'Informe a quantidade de vagas').max(MAX_CAPACITY_PER_SLOT),
}).refine((value) => value.horaFim === buildScheduleEndTime(value.horaInicio), {
  message: 'Hora final deve ser exatamente uma hora após o início',
  path: ['horaFim'],
})

const horariosQuerySchema = z.object({
  diaSemana: z.nativeEnum(DiaSemana).nullish(),
  ativo: z.enum(['true', 'false']).nullish(),
})

export async function GET(request: NextRequest) {
  return withApiAuth(async () => {
    const searchParams = request.nextUrl.searchParams
    const parsed = horariosQuerySchema.safeParse({
      diaSemana: searchParams.get('diaSemana'),
      ativo: searchParams.get('ativo'),
    })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Parâmetros de busca inválidos' }, { status: 400 })
    }

    const horarios = await listHorarios({
      diaSemana: parsed.data.diaSemana ?? null,
      ativo: parsed.data.ativo == null ? null : parsed.data.ativo === 'true',
    })

    return NextResponse.json(horarios)
  })
}

export async function POST(request: NextRequest) {
  return withApiAuth(async () => {
    const validation = await validateRequest(request, horarioSchema, {
      errorMessage: () => 'Campos obrigatorios: diaSemana, horaInicio, horaFim, vagasTotal',
    })

    if ('error' in validation) {
      return validation.error
    }

    const horario = await createHorario(validation.data)
    return NextResponse.json(horario, { status: 201 })
  }, { requiredRole: 'ADMIN' })
}
