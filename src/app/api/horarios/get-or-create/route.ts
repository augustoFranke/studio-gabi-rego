import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { DiaSemana } from '@prisma/client'
import { MAX_CAPACITY_PER_SLOT } from '@/lib/schedule'

// POST /api/horarios/get-or-create - Get existing or create new horario
export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { diaSemana, horaInicio } = body

    if (!diaSemana || !horaInicio) {
      return NextResponse.json(
        { error: 'Campos obrigatorios: diaSemana, horaInicio' },
        { status: 400 }
      )
    }

    // Normalize hora
    const hora = horaInicio.split(':')[0].padStart(2, '0')
    const horaInicioNorm = `${hora}:00`
    const horaFimNorm = `${(parseInt(hora, 10) + 1).toString().padStart(2, '0')}:00`

    // Try to find existing horario
    let horario = await prisma.horarioDisponivel.findFirst({
      where: {
        diaSemana: diaSemana as DiaSemana,
        horaInicio: horaInicioNorm,
        ativo: true,
      },
    })

    // If not found, create new one
    if (!horario) {
      horario = await prisma.horarioDisponivel.create({
        data: {
          diaSemana: diaSemana as DiaSemana,
          horaInicio: horaInicioNorm,
          horaFim: horaFimNorm,
          vagasTotal: MAX_CAPACITY_PER_SLOT,
        },
      })
    }

    return NextResponse.json(horario)
  } catch (error) {
    console.error('Erro ao obter/criar horario:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
