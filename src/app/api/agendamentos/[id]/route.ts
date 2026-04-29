import { NextRequest, NextResponse } from 'next/server'
import { ensureOwnerOrAdmin, withApiAuth } from '@/lib/api'
import {
  AgendamentoServiceError,
  deleteAgendamento,
  getAgendamentoById,
  updateAgendamento,
} from '@/services/agendamento.service'
import { DiaSemana } from '@prisma/client'
import { z } from 'zod'

const hourSchema = z.string().regex(/^([01]\d|2[0-3]):00$/, 'Informe uma hora cheia válida')

const agendamentoUpdateSchema = z.object({
  presente: z.boolean().optional(),
  observacao: z.string().optional(),
  horarioId: z.string().optional(),
  diaSemana: z.nativeEnum(DiaSemana).optional(),
  horaInicio: hourSchema.optional(),
  data: z.string().optional(),
  scope: z.enum(['single', 'future']).optional(),
}).refine(
  (value) => !value.diaSemana === !value.horaInicio,
  { message: 'Informe dia da semana e horário juntos' }
)

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
    const rawBody = await request.text()
    let body: unknown = {}
    if (rawBody) {
      try {
        body = JSON.parse(rawBody)
      } catch {
        return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
      }
    }

    const validation = agendamentoUpdateSchema.safeParse(body)
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
    const rawBody = await request.text()
    let body: unknown = {}
    if (rawBody) {
      try {
        body = JSON.parse(rawBody)
      } catch {
        return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
      }
    }
    const validation = agendamentoDeleteSchema.safeParse(body)
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
