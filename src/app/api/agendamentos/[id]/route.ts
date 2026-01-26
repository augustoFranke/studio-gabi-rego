import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth } from '@/lib/api'
import { parseLocalDate } from '@/lib/schedule'
import { Prisma } from '@prisma/client'

const agendamentoSelect = {
  id: true,
  membroId: true,
  horarioId: true,
  data: true,
  presente: true,
  observacao: true,
  membro: {
    select: {
      id: true,
      fotoUrl: true,
      usuario: {
        select: { nome: true, email: true },
      },
    },
  },
  horario: {
    select: {
      id: true,
      diaSemana: true,
      horaInicio: true,
      horaFim: true,
      vagasTotal: true,
    },
  },
} satisfies Prisma.AgendamentoSelect

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(async (session) => {
    const { id } = await params
    const agendamento = await prisma.agendamento.findUnique({
      where: { id },
      select: agendamentoSelect,
    })

    if (!agendamento) {
      return NextResponse.json({ error: 'Agendamento nao encontrado' }, { status: 404 })
    }

    if (session.user.role === 'MEMBRO' && agendamento.membroId !== session.user.membroId) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 403 })
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
    const body = await request.json()
    const { presente, observacao, horarioId, data } = body

    const agendamento = await prisma.agendamento.findUnique({
      where: { id },
    })

    if (!agendamento) {
      return NextResponse.json({ error: 'Agendamento nao encontrado' }, { status: 404 })
    }

    const updateData: Prisma.AgendamentoUpdateInput = {}

    if (presente !== undefined) {
      updateData.presente = presente
    }

    if (observacao !== undefined) {
      updateData.observacao = observacao
    }

    if (horarioId || data) {
      const newHorarioId = horarioId || agendamento.horarioId
      const newData = data ? parseLocalDate(data) : agendamento.data

      const existente = await prisma.agendamento.findFirst({
        where: {
          membroId: agendamento.membroId,
          horarioId: newHorarioId,
          data: newData,
          id: { not: id },
        },
      })

      if (existente) {
        return NextResponse.json(
          { error: 'Ja existe agendamento neste horario e data' },
          { status: 400 }
        )
      }

      const horario = await prisma.horarioDisponivel.findUnique({
        where: { id: newHorarioId },
      })

      if (!horario || !horario.ativo) {
        return NextResponse.json({ error: 'Horario nao disponivel' }, { status: 400 })
      }

      const agendamentosExistentes = await prisma.agendamento.count({
        where: {
          horarioId: newHorarioId,
          data: newData,
          id: { not: id },
        },
      })

      if (agendamentosExistentes >= horario.vagasTotal) {
        return NextResponse.json(
          { error: 'Nao ha vagas disponiveis neste horario' },
          { status: 400 }
        )
      }

      if (horarioId) updateData.horario = { connect: { id: horarioId } }
      if (data) updateData.data = newData
    }

    const agendamentoAtualizado = await prisma.agendamento.update({
      where: { id },
      data: updateData,
      select: agendamentoSelect,
    })

    return NextResponse.json(agendamentoAtualizado)
  }, { requiredRole: 'ADMIN' })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(async () => {
    const { id } = await params
    const agendamento = await prisma.agendamento.findUnique({
      where: { id },
    })

    if (!agendamento) {
      return NextResponse.json({ error: 'Agendamento nao encontrado' }, { status: 404 })
    }

    await prisma.agendamento.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  }, { requiredRole: 'ADMIN' })
}
