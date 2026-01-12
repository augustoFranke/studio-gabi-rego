import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { DiaSemana } from '@prisma/client'

// GET /api/horarios - Listar horarios disponiveis
export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const diaSemana = searchParams.get('diaSemana') as DiaSemana | null
  const ativo = searchParams.get('ativo')

  const where: Record<string, unknown> = {}

  if (diaSemana) {
    where.diaSemana = diaSemana
  }

  if (ativo !== null) {
    where.ativo = ativo === 'true'
  }

  const horarios = await prisma.horarioDisponivel.findMany({
    where,
    orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
  })

  return NextResponse.json(horarios)
}

// POST /api/horarios - Criar novo horario disponivel
export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { diaSemana, horaInicio, horaFim, vagasTotal } = body

    if (!diaSemana || !horaInicio || !horaFim || !vagasTotal) {
      return NextResponse.json(
        { error: 'Campos obrigatorios: diaSemana, horaInicio, horaFim, vagasTotal' },
        { status: 400 }
      )
    }

    // Verificar se ja existe horario no mesmo dia e hora
    const existente = await prisma.horarioDisponivel.findFirst({
      where: {
        diaSemana,
        horaInicio,
        ativo: true,
      },
    })

    if (existente) {
      return NextResponse.json(
        { error: 'Ja existe um horario neste dia e hora' },
        { status: 400 }
      )
    }

    const horario = await prisma.horarioDisponivel.create({
      data: {
        diaSemana,
        horaInicio,
        horaFim,
        vagasTotal,
      },
    })

    return NextResponse.json(horario, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar horario:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
