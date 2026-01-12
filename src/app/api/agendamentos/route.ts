import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth } from '@/lib/api'
import { parseLocalDate } from '@/lib/schedule'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

const agendamentoSchema = z.object({
  membroId: z.string().optional(),
  horarioId: z.string().optional(),
  data: z.string().optional(),
})

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
      where.data = {
        gte: parseLocalDate(dataInicio),
        lte: parseLocalDate(dataFim),
      }
    }

    const agendamentos = await prisma.agendamento.findMany({
      where,
      include: {
        membro: {
          include: {
            usuario: {
              select: { nome: true },
            },
          },
        },
        horario: true,
      },
      orderBy: [{ data: 'asc' }, { horario: { horaInicio: 'asc' } }],
    })

    return NextResponse.json(agendamentos)
  })
}

// POST /api/agendamentos - Criar novo agendamento
export async function POST(request: NextRequest) {
  return withApiAuth(async (session) => {
    const body = await request.json()
    const validation = agendamentoSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { membroId, horarioId, data } = validation.data

    // Se for membro, só pode agendar para si mesmo
    const membroIdFinal =
      session.user.role === 'MEMBRO' ? session.user.membroId : membroId

    if (!membroIdFinal) {
      return NextResponse.json({ error: 'Membro ID não identificado' }, { status: 400 })
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

    const agendamento = await prisma.agendamento.create({
      data: {
        membroId: membroIdFinal,
        horarioId,
        data: dataAgendamento,
      },
      include: {
        membro: {
          include: {
            usuario: {
              select: { nome: true },
            },
          },
        },
        horario: true,
      },
    })

    return NextResponse.json(agendamento, { status: 201 })
  })
}

