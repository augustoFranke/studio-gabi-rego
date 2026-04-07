import { prisma } from '@/lib/prisma'
import { MAX_CAPACITY_PER_SLOT } from '@/lib/schedule'
import { DiaSemana, Prisma } from '@prisma/client'

export class HorarioServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message)
    this.name = 'HorarioServiceError'
  }
}

type ListHorariosParams = {
  diaSemana?: DiaSemana | null
  ativo?: boolean | null
}

type CreateHorarioInput = {
  diaSemana: DiaSemana
  horaInicio: string
  horaFim: string
  vagasTotal: number
}

type GetOrCreateHorarioInput = {
  diaSemana: DiaSemana
  horaInicio: string
}

function normalizeHoraInicio(horaInicio: string) {
  const hora = horaInicio.split(':')[0].padStart(2, '0')
  return `${hora}:00`
}

function buildHoraFim(horaInicio: string) {
  const hora = parseInt(horaInicio.split(':')[0], 10)
  return `${(hora + 1).toString().padStart(2, '0')}:00`
}

export async function listHorarios(params: ListHorariosParams) {
  const where: Prisma.HorarioDisponivelWhereInput = {}

  if (params.diaSemana) {
    where.diaSemana = params.diaSemana
  }

  if (params.ativo !== null && params.ativo !== undefined) {
    where.ativo = params.ativo
  }

  return prisma.horarioDisponivel.findMany({
    where,
    orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
  })
}

export async function createHorario(input: CreateHorarioInput) {
  const existente = await prisma.horarioDisponivel.findFirst({
    where: {
      diaSemana: input.diaSemana,
      horaInicio: input.horaInicio,
      ativo: true,
    },
  })

  if (existente) {
    throw new HorarioServiceError('Ja existe um horario neste dia e hora', 'HORARIO_ALREADY_EXISTS', 400)
  }

  try {
    return await prisma.horarioDisponivel.create({
      data: input,
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HorarioServiceError('Ja existe um horario neste dia e hora', 'HORARIO_ALREADY_EXISTS', 400)
    }
    throw error
  }
}

export async function getOrCreateHorario(input: GetOrCreateHorarioInput) {
  const horaInicio = normalizeHoraInicio(input.horaInicio)
  const horaFim = buildHoraFim(horaInicio)

  let horario = await prisma.horarioDisponivel.findFirst({
    where: {
      diaSemana: input.diaSemana,
      horaInicio,
      ativo: true,
    },
  })

  if (!horario) {
    try {
      horario = await prisma.horarioDisponivel.create({
        data: {
          diaSemana: input.diaSemana,
          horaInicio,
          horaFim,
          vagasTotal: MAX_CAPACITY_PER_SLOT,
        },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        horario = await prisma.horarioDisponivel.findFirst({
          where: {
            diaSemana: input.diaSemana,
            horaInicio,
            ativo: true,
          },
        })
      } else {
        throw error
      }
    }
  }

  if (!horario) {
    throw new HorarioServiceError('Nao foi possivel obter horario', 'HORARIO_NOT_FOUND', 409)
  }

  return horario
}
