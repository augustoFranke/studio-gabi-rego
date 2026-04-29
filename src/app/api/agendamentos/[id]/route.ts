import { NextRequest, NextResponse } from 'next/server'
import { ensureOwnerOrAdmin, withApiAuth } from '@/lib/api'
import {
  AgendamentoServiceError,
  deleteAgendamento,
  getAgendamentoById,
  updateAgendamento,
} from '@/services/agendamento.service'
import { agendamentoUpdateSchema } from '@/features/scheduling/contracts'
import { readOptionalJsonBody } from '@/lib/http'
import { z } from 'zod'

const agendamentoDeleteSchema = z.object({
  scope: z.enum(['single', 'future']).optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(async (session) => {
    const { id } = await params
    const agendamento = await getAgendamentoById(id)

    if (!agendamento) {
      return NextResponse.json({ error: 'Agendamento nao encontrado' }, { status: 404 })
    }

    const authError = ensureOwnerOrAdmin(session, agendamento.membroId, { error: 'Nao autorizado' })
    if (authError) {
      return authError
    }

    return NextResponse.json(agendamento)
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(async () => {
    const { id } = await params
    const parsedBody = await readOptionalJsonBody(request)
    if (!parsedBody.ok) {
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    }

    const validation = agendamentoUpdateSchema.safeParse(parsedBody.body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message ?? 'Dados inválidos.' }, { status: 400 })
    }

    try {
      const agendamentoAtualizado = await updateAgendamento({
        id,
        ...validation.data,
      })

      return NextResponse.json(agendamentoAtualizado)
    } catch (error) {
      if (error instanceof AgendamentoServiceError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }

      throw error
    }
  }, { requiredRole: 'ADMIN' })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(async () => {
    const { id } = await params
    const parsedBody = await readOptionalJsonBody(request)
    if (!parsedBody.ok) {
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    }
    const validation = agendamentoDeleteSchema.safeParse(parsedBody.body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    }

    try {
      await deleteAgendamento({
        id,
        scope: validation.data.scope,
      })
    } catch (error) {
      if (error instanceof AgendamentoServiceError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }

      throw error
    }

    return NextResponse.json({ success: true })
  }, { requiredRole: 'ADMIN' })
}
