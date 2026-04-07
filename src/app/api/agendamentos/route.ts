import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth, validateRequest } from '@/lib/api'
import {
  AgendamentoServiceError,
  createAgendamento,
  listAgendamentos,
} from '@/services/agendamento.service'
import { z } from 'zod'

const agendamentoSchema = z.object({
  membroId: z.string().optional(),
  horarioId: z.string().optional(),
  data: z.string().optional(),
  scope: z.enum(['single', 'weekly']).optional(),
})

// GET /api/agendamentos - Listar agendamentos
export async function GET(request: NextRequest) {
  return withApiAuth(async (session) => {
    const searchParams = request.nextUrl.searchParams
    try {
      const agendamentos = await listAgendamentos({
        sessionRole: session.user.role,
        sessionMembroId: session.user.membroId,
        membroId: searchParams.get('membroId'),
        dataInicio: searchParams.get('dataInicio'),
        dataFim: searchParams.get('dataFim'),
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

// POST /api/agendamentos - Criar novo agendamento
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
