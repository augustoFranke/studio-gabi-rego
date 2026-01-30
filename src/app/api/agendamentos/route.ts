import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth, validateRequest } from '@/lib/api'
import { parseLocalDate } from '@/lib/schedule'
import { syncAgendamentosRecorrentes, validateHorarioFixoLimit } from '@/services/agendamento.service'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

const agendamentoSchema = z.object({
  membroId: z.string().optional(),
  horarioId: z.string().optional(),
  data: z.string().optional(),
  scope: z.enum(['single', 'weekly']).optional(),
})

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

// GET /api/agendamentos - Listar agendamentos
export async function GET(request: NextRequest) {
  return withApiAuth(async (session) => {
    const searchParams = request.nextUrl.searchParams
    const dataInicio = searchParams.get('dataInicio')
    const dataFim = searchParams.get('dataFim')
    const membroId = searchParams.get('membroId')

    const where: Prisma.AgendamentoWhereInput = {}

    // Se for membro, só pode ver seus próprios agendamentos
    if (session.user.role === 'MEMBRO' && session.user.membroId) {
      where.membroId = session.user.membroId
    } else if (membroId) {
      where.membroId = membroId
    }

    if (dataInicio && dataFim) {
      const inicio = parseLocalDate(dataInicio)
      const fim = parseLocalDate(dataFim)
      const hoje = new Date()
      hoje.setHours(12, 0, 0, 0)

      if (fim >= hoje) {
        const inicioSync = inicio > hoje ? inicio : hoje
        const membroScope =
          session.user.role === 'MEMBRO' ? session.user.membroId : membroId ?? undefined

        await syncAgendamentosRecorrentes({
          startDate: inicioSync,
          endDate: fim,
          membroId: membroScope,
        })
      }

      where.data = {
        gte: inicio,
        lte: fim,
      }
    }

    const agendamentos = await prisma.agendamento.findMany({
      where,
      select: agendamentoSelect,
      orderBy: [{ data: 'asc' }, { horario: { horaInicio: 'asc' } }],
    })

    return NextResponse.json(agendamentos)
  })
}

// POST /api/agendamentos - Criar novo agendamento
export async function POST(request: NextRequest) {
  return withApiAuth(async (session) => {
    const validation = await validateRequest(request, agendamentoSchema)

    if ('error' in validation) {
      return validation.error
    }

    const { membroId, horarioId, data, scope } = validation.data
    const recurrenceScope =
      session.user.role === 'ADMIN' ? scope ?? 'single' : 'single'

    // Se for membro, só pode agendar para si mesmo
    const membroIdFinal =
      session.user.role === 'MEMBRO' ? session.user.membroId : membroId

    if (!membroIdFinal) {
      return NextResponse.json({ error: 'Membro ID não identificado' }, { status: 400 })
    }

    if (!horarioId) {
      return NextResponse.json({ error: 'Horário não informado' }, { status: 400 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Data não informada' }, { status: 400 })
    }

    // Verificar se o horário existe e está ativo
    const horario = await prisma.horarioDisponivel.findUnique({
      where: { id: horarioId },
    })

    if (!horario || !horario.ativo) {
      return NextResponse.json({ error: 'Horário não disponível' }, { status: 400 })
    }

    // Verificar vagas disponíveis
    const dataAgendamento = parseLocalDate(data)
    const agendamentosExistentes = await prisma.agendamento.count({
      where: {
        horarioId,
        data: dataAgendamento,
      },
    })

    if (agendamentosExistentes >= horario.vagasTotal) {
      return NextResponse.json({ error: 'Não há vagas disponíveis neste horário' }, { status: 400 })
    }

    // Verificar se o membro já tem agendamento neste horário/data
    const jaAgendado = await prisma.agendamento.findFirst({
      where: {
        membroId: membroIdFinal,
        horarioId,
        data: dataAgendamento,
      },
    })

    if (jaAgendado) {
      return NextResponse.json({ error: 'Você já tem um agendamento neste horário' }, { status: 400 })
    }

    if (recurrenceScope === 'weekly') {
      const limitCheck = await validateHorarioFixoLimit({
        membroId: membroIdFinal,
        diaSemana: horario.diaSemana,
        hora: horario.horaInicio,
      })

      if (!limitCheck.ok) {
        return NextResponse.json({ error: limitCheck.error }, { status: 400 })
      }

      const horarioFixoExistente = await prisma.horarioFixo.findFirst({
        where: {
          membroId: membroIdFinal,
          diaSemana: horario.diaSemana,
          hora: horario.horaInicio,
        },
        select: { id: true },
      })

      if (!horarioFixoExistente) {
        await prisma.horarioFixo.create({
          data: {
            membroId: membroIdFinal,
            diaSemana: horario.diaSemana,
            hora: horario.horaInicio,
          },
        })
      }
    }

    const agendamento = await prisma.agendamento.create({
      data: {
        membroId: membroIdFinal,
        horarioId,
        data: dataAgendamento,
      },
      select: agendamentoSelect,
    })

    return NextResponse.json(agendamento, { status: 201 })
  })
}
