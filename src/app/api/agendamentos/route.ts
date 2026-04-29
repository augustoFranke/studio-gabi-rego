import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth, validateRequest } from '@/lib/api'
import {
  AgendamentoServiceError,
  createAgendamento,
  listAgendamentos,
} from '@/services/agendamento.service'
import { DiaSemana } from '@prisma/client'
import { z } from 'zod'

const hourSchema = z.string().regex(/^([01]\d|2[0-3]):00$/, 'Informe uma hora cheia válida')

const agendamentoSchema = z.object({
  membroId: z.string().optional(),
  horarioId: z.string().optional(),
  diaSemana: z.nativeEnum(DiaSemana).optional(),
  horaInicio: hourSchema.optional(),
  data: z.string().optional(),
  scope: z.enum(['single', 'weekly']).optional(),
}).refine(
  (value) => Boolean(value.horarioId || (value.diaSemana && value.horaInicio)),
  { message: 'Horário não informado' }
)

const dateParamSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const agendamentosQuerySchema = z.object({
  membroId: z.string().min(1).nullable(),
  dataInicio: dateParamSchema,
  dataFim: dateParamSchema,
}).refine((value) => {
  const start = new Date(`${value.dataInicio}T00:00:00.000Z`)
  const end = new Date(`${value.dataFim}T00:00:00.000Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return false
  }

  return end.getTime() - start.getTime() <= 1000 * 60 * 60 * 24 * 45
}, 'Intervalo de datas inválido')

export async function GET(request: NextRequest) {
  return withApiAuth(async (session) => {
    const searchParams = request.nextUrl.searchParams
    try {
      const validation = agendamentosQuerySchema.safeParse({
        membroId: searchParams.get('membroId'),
        dataInicio: searchParams.get('dataInicio'),
        dataFim: searchParams.get('dataFim'),
      })

      if (!validation.success) {
        return NextResponse.json({ error: 'Informe um intervalo de datas válido' }, { status: 400 })
      }

      const agendamentos = await listAgendamentos({
        sessionRole: session.user.role,
        sessionMembroId: session.user.membroId,
        ...validation.data,
      })

      return NextResponse.json(agendamentos)
    } catch (error) {
      if (error instanceof AgendamentoServiceError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }

      throw error
    }
  })
}

export async function POST(request: NextRequest) {
  return withApiAuth(async (session) => {
    const validation = await validateRequest(request, agendamentoSchema)

    if ('error' in validation) {
      return validation.error
    }

    try {
      const agendamento = await createAgendamento({
        sessionRole: session.user.role,
        sessionMembroId: session.user.membroId,
        ...validation.data,
      })

      return NextResponse.json(agendamento, { status: 201 })
    } catch (error) {
      if (error instanceof AgendamentoServiceError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }

      throw error
    }
  })
}
