import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth, validateRequest } from '@/lib/api'
import {
  AgendamentoServiceError,
  createAgendamento,
  listAgendamentos,
} from '@/services/agendamento.service'
import { agendamentoCreateSchema, agendamentosQuerySchema } from '@/features/scheduling/contracts'

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
    const validation = await validateRequest(request, agendamentoCreateSchema)

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
