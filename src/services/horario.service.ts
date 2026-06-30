import { prisma } from '@/lib/prisma'
import { buildScheduleEndTime, isSchedulableHourString, MAX_CAPACITY_PER_SLOT } from '@/lib/schedule'
import { DiaSemana, Prisma } from '@prisma/client'

import { ServiceError as HorarioServiceError } from './errors'
export { ServiceError as HorarioServiceError } from './errors'

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
  return buildScheduleEndTime(horaInicio)
}

function assertSchedulableHour(horaInicio: string) {
  if (!isSchedulableHourString(horaInicio)) {
    throw new HorarioServiceError('Horario fora da grade permitida', 'INVALID_HORARIO', 400)
  }
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
  const horaInicio = normalizeHoraInicio(input.horaInicio)
  assertSchedulableHour(horaInicio)
  const horaFim = buildHoraFim(horaInicio)

  if (input.horaFim !== horaFim) {
    throw new HorarioServiceError('Hora final deve ser exatamente uma hora apos o inicio', 'INVALID_HORARIO', 400)
  }

  const existente = await prisma.horarioDisponivel.findFirst({
    where: {
      diaSemana: input.diaSemana,
      horaInicio,
      ativo: true,
    },
  })

  if (existente) {
    throw new HorarioServiceError('Ja existe um horario neste dia e hora', 'HORARIO_ALREADY_EXISTS', 400)
  }

  try {
    return await prisma.horarioDisponivel.create({
      data: {
        ...input,
        horaInicio,
        horaFim,
      },
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
  assertSchedulableHour(horaInicio)
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
