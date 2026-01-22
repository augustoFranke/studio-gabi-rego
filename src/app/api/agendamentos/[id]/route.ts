import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { Prisma } from '@prisma/client'

// Helper to parse date string as local date (not UTC)
function parseLocalDate(dateStr: string): Date {
  // If it's just a date (yyyy-MM-dd), parse as local midnight
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day, 12, 0, 0) // noon to avoid timezone edge cases
  }
  // Otherwise parse as-is (ISO string with time)
  return new Date(dateStr)
}

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

// GET /api/agendamentos/[id] - Obter agendamento especifico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params

  if (!session) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const agendamento = await prisma.agendamento.findUnique({
    where: { id },
    select: agendamentoSelect,
  })

  if (!agendamento) {
    return NextResponse.json({ error: 'Agendamento nao encontrado' }, { status: 404 })
  }

  // Se for membro, so pode ver seus proprios agendamentos
  if (
    session.user.role === 'MEMBRO' &&
    agendamento.membroId !== session.user.membroId
  ) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 403 })
  }

  return NextResponse.json(agendamento)
}

// PATCH /api/agendamentos/[id] - Atualizar agendamento
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { presente, observacao, horarioId, data } = body

    // Verificar se o agendamento existe
    const agendamento = await prisma.agendamento.findUnique({
      where: { id },
    })

    if (!agendamento) {
      return NextResponse.json({ error: 'Agendamento nao encontrado' }, { status: 404 })
    }

    // Preparar dados para atualizacao
    const updateData: Record<string, unknown> = {}

    if (presente !== undefined) {
      updateData.presente = presente
    }

    if (observacao !== undefined) {
      updateData.observacao = observacao
    }

    // Se estiver mudando horario ou data, verificar disponibilidade
    if (horarioId || data) {
      const newHorarioId = horarioId || agendamento.horarioId
      const newData = data ? parseLocalDate(data) : agendamento.data

      // Verificar se ja existe agendamento neste horario/data
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

      // Verificar vagas disponiveis
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

      if (horarioId) updateData.horarioId = horarioId
      if (data) updateData.data = newData
    }

    const agendamentoAtualizado = await prisma.agendamento.update({
      where: { id },
      data: updateData,
      select: agendamentoSelect,
    })

    return NextResponse.json(agendamentoAtualizado)
  } catch (error) {
    console.error('Erro ao atualizar agendamento:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// DELETE /api/agendamentos/[id] - Remover agendamento
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  try {
    // Verificar se o agendamento existe
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
  } catch (error) {
    console.error('Erro ao remover agendamento:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
