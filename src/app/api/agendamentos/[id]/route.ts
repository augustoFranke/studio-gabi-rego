import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureOwnerOrAdmin, withApiAuth } from '@/lib/api'
import { parseLocalDate } from '@/lib/schedule'
import { validateHorarioFixoLimit } from '@/services/agendamento.service'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

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

const agendamentoUpdateSchema = z.object({
  presente: z.boolean().optional(),
  observacao: z.string().optional(),
  horarioId: z.string().optional(),
  data: z.string().optional(),
  scope: z.enum(['single', 'future']).optional(),
})

const agendamentoDeleteSchema = z.object({
  scope: z.enum(['single', 'future']).optional(),
})

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

    const { presente, observacao, horarioId, data, scope } = validation.data
    const updateScope = scope ?? 'single'

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

      if (updateScope === 'future' && newHorarioId !== agendamento.horarioId) {
        const horarioAtual = await prisma.horarioDisponivel.findUnique({
          where: { id: agendamento.horarioId },
        })

        if (!horarioAtual) {
          return NextResponse.json({ error: 'Horario atual nao encontrado' }, { status: 400 })
        }

        const horarioFixoAtual = await prisma.horarioFixo.findFirst({
          where: {
            membroId: agendamento.membroId,
            diaSemana: horarioAtual.diaSemana,
            hora: horarioAtual.horaInicio,
          },
          select: { id: true },
        })

        const horarioFixoNovo = await prisma.horarioFixo.findFirst({
          where: {
            membroId: agendamento.membroId,
            diaSemana: horario.diaSemana,
            hora: horario.horaInicio,
          },
          select: { id: true },
        })

        if (!horarioFixoNovo && !horarioFixoAtual) {
          const limitCheck = await validateHorarioFixoLimit({
            membroId: agendamento.membroId,
            diaSemana: horario.diaSemana,
            hora: horario.horaInicio,
          })

          if (!limitCheck.ok) {
            return NextResponse.json({ error: limitCheck.error }, { status: 400 })
          }
        }

        if (horarioFixoAtual && !horarioFixoNovo) {
          await prisma.horarioFixo.update({
            where: { id: horarioFixoAtual.id },
            data: {
              diaSemana: horario.diaSemana,
              hora: horario.horaInicio,
            },
          })
        } else if (!horarioFixoNovo && !horarioFixoAtual) {
          await prisma.horarioFixo.create({
            data: {
              membroId: agendamento.membroId,
              diaSemana: horario.diaSemana,
              hora: horario.horaInicio,
            },
          })
        } else if (horarioFixoAtual && horarioFixoNovo) {
          await prisma.horarioFixo.delete({
            where: { id: horarioFixoAtual.id },
          })
        }

        const hoje = new Date()
        hoje.setHours(12, 0, 0, 0)

        await prisma.agendamento.deleteMany({
          where: {
            membroId: agendamento.membroId,
            horarioId: agendamento.horarioId,
            data: {
              gte: hoje,
            },
            id: { not: id },
          },
        })
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

    const deleteScope = validation.data.scope ?? 'single'
    const agendamento = await prisma.agendamento.findUnique({
      where: { id },
      include: { horario: true },
    })

    if (!agendamento) {
      return NextResponse.json({ error: 'Agendamento nao encontrado' }, { status: 404 })
    }

    if (deleteScope === 'future') {
      await prisma.horarioFixo.deleteMany({
        where: {
          membroId: agendamento.membroId,
          diaSemana: agendamento.horario.diaSemana,
          hora: agendamento.horario.horaInicio,
        },
      })

      const hoje = new Date()
      hoje.setHours(12, 0, 0, 0)

      await prisma.agendamento.deleteMany({
        where: {
          membroId: agendamento.membroId,
          horarioId: agendamento.horarioId,
          data: {
            gte: hoje,
          },
        },
      })
    } else {
      await prisma.agendamento.delete({
        where: { id },
      })
    }

    return NextResponse.json({ success: true })
  }, { requiredRole: 'ADMIN' })
}
