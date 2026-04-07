import { prisma } from '@/lib/prisma'
import { getAppTimezone, getYmdInTimeZone } from '@/lib/dates'
import { DiaSemana, Prisma, StatusMembro } from '@prisma/client'
import { MAX_CAPACITY_PER_SLOT, parseLocalDate } from '@/lib/schedule'

export const agendamentoSelect = {
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

type SyncRecurringParams = {
  startDate: Date
  endDate: Date
  membroId?: string
}

type LimitCheckParams = {
  membroId: string
  diaSemana: DiaSemana
  hora: string
}

type LimitCheckResult = { ok: true } | { ok: false; error: string }

type ListAgendamentosParams = {
  sessionRole: 'ADMIN' | 'MEMBRO'
  sessionMembroId?: string
  membroId?: string | null
  dataInicio?: string | null
  dataFim?: string | null
}

type CreateAgendamentoParams = {
  sessionRole: 'ADMIN' | 'MEMBRO'
  sessionMembroId?: string
  membroId?: string
  horarioId?: string
  data?: string
  scope?: 'single' | 'weekly'
}

type UpdateAgendamentoParams = {
  id: string
  presente?: boolean
  observacao?: string
  horarioId?: string
  data?: string
  scope?: 'single' | 'future'
}

type DeleteAgendamentoParams = {
  id: string
  scope?: 'single' | 'future'
}

export class AgendamentoServiceError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'AgendamentoServiceError'
  }
}

function throwAgendamentoError(message: string, status = 400): never {
  throw new AgendamentoServiceError(message, status)
}

function getOccurrenceDate(date: Date) {
  return parseLocalDate(getYmdInTimeZone(date, getAppTimezone()))
}

function normalizeDate(date: Date) {
  const normalized = new Date(date)
  normalized.setHours(12, 0, 0, 0)
  return normalized
}

function getDateKey(date: Date) {
  return normalizeDate(date).toISOString().split('T')[0]
}

function buildHoraFim(horaInicio: string) {
  const hora = parseInt(horaInicio.split(':')[0], 10)
  const horaFim = (hora + 1).toString().padStart(2, '0')
  return `${horaFim}:00`
}

function slotKey(diaSemana: DiaSemana, hora: string) {
  return `${diaSemana}-${hora}`
}

export async function validateHorarioFixoLimit(params: LimitCheckParams): Promise<LimitCheckResult> {
  const membro = await prisma.membro.findUnique({
    where: { id: params.membroId },
    select: {
      id: true,
      plano: { select: { aulasSemanais: true } },
      horariosFixos: { select: { diaSemana: true, hora: true } },
    },
  })

  if (!membro) {
    return { ok: false, error: 'Membro não encontrado.' }
  }

  const aulasSemanais = membro.plano?.aulasSemanais
  if (!aulasSemanais || aulasSemanais === 7) {
    return { ok: true }
  }

  const jaTemHorario = membro.horariosFixos.some(
    (horario) => horario.diaSemana === params.diaSemana && horario.hora === params.hora
  )

  if (jaTemHorario) {
    return { ok: true }
  }

  const totalHorarios = membro.horariosFixos.length
  if (totalHorarios >= aulasSemanais) {
    return {
      ok: false,
      error: `Limite do plano: ${aulasSemanais} aulas por semana. O membro já possui ${totalHorarios} horários fixos. Remova um horário fixo para adicionar outro.`,
    }
  }

  return { ok: true }
}

export async function listAgendamentos(params: ListAgendamentosParams) {
  const { sessionRole, sessionMembroId, membroId, dataInicio, dataFim } = params

  if (sessionRole === 'MEMBRO' && !sessionMembroId) {
    throwAgendamentoError('Perfil incompleto', 403)
  }

  const where: Prisma.AgendamentoWhereInput = {}

  if (sessionRole === 'MEMBRO' && sessionMembroId) {
    where.membroId = sessionMembroId
  } else if (membroId) {
    where.membroId = membroId
  }

  if (dataInicio && dataFim) {
    where.data = {
      gte: parseLocalDate(dataInicio),
      lte: parseLocalDate(dataFim),
    }
  }

  return prisma.agendamento.findMany({
    where,
    select: agendamentoSelect,
    orderBy: [{ data: 'asc' }, { horario: { horaInicio: 'asc' } }],
  })
}

export async function getAgendamentoById(id: string) {
  return prisma.agendamento.findUnique({
    where: { id },
    select: agendamentoSelect,
  })
}

export async function createAgendamento(params: CreateAgendamentoParams) {
  const { sessionRole, sessionMembroId, membroId, horarioId, data, scope } = params
  const recurrenceScope = sessionRole === 'ADMIN' ? scope ?? 'single' : 'single'
  const membroIdFinal = sessionRole === 'MEMBRO' ? sessionMembroId : membroId

  if (!membroIdFinal) {
    throwAgendamentoError('Membro ID não identificado')
  }

  if (!horarioId) {
    throwAgendamentoError('Horário não informado')
  }

  if (!data) {
    throwAgendamentoError('Data não informada')
  }

  const dataAgendamento = parseLocalDate(data)
  const [horario, agendamentosExistentes, jaAgendado] = await Promise.all([
    prisma.horarioDisponivel.findUnique({
      where: { id: horarioId },
    }),
    prisma.agendamento.count({
      where: {
        horarioId,
        data: dataAgendamento,
      },
    }),
    prisma.agendamento.findFirst({
      where: {
        membroId: membroIdFinal,
        horarioId,
        data: dataAgendamento,
      },
    }),
  ])

  if (!horario || !horario.ativo) {
    throwAgendamentoError('Horário não disponível')
  }

  if (agendamentosExistentes >= horario.vagasTotal) {
    throwAgendamentoError('Não há vagas disponíveis neste horário')
  }

  if (jaAgendado) {
    throwAgendamentoError('Você já tem um agendamento neste horário')
  }

  if (recurrenceScope === 'weekly') {
    const limitCheck = await validateHorarioFixoLimit({
      membroId: membroIdFinal,
      diaSemana: horario.diaSemana,
      hora: horario.horaInicio,
    })

    if (!limitCheck.ok) {
      throwAgendamentoError(limitCheck.error)
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

  return prisma.agendamento.create({
    data: {
      membroId: membroIdFinal,
      horarioId,
      data: dataAgendamento,
    },
    select: agendamentoSelect,
  })
}

export async function updateAgendamento(params: UpdateAgendamentoParams) {
  const { id, presente, observacao, horarioId, data, scope } = params
  const updateScope = scope ?? 'single'
  const agendamento = await prisma.agendamento.findUnique({
    where: { id },
  })

  if (!agendamento) {
    throwAgendamentoError('Agendamento nao encontrado', 404)
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

    const [existente, horario, agendamentosExistentes] = await Promise.all([
      prisma.agendamento.findFirst({
        where: {
          membroId: agendamento.membroId,
          horarioId: newHorarioId,
          data: newData,
          id: { not: id },
        },
      }),
      prisma.horarioDisponivel.findUnique({
        where: { id: newHorarioId },
      }),
      prisma.agendamento.count({
        where: {
          horarioId: newHorarioId,
          data: newData,
          id: { not: id },
        },
      }),
    ])

    if (existente) {
      throwAgendamentoError('Ja existe agendamento neste horario e data')
    }

    if (!horario || !horario.ativo) {
      throwAgendamentoError('Horario nao disponivel')
    }

    if (agendamentosExistentes >= horario.vagasTotal) {
      throwAgendamentoError('Nao ha vagas disponiveis neste horario')
    }

    if (updateScope === 'future' && newHorarioId !== agendamento.horarioId) {
      const selectedOccurrenceDate = getOccurrenceDate(agendamento.data)

      const [horarioAtual, horarioFixoNovo] = await Promise.all([
        prisma.horarioDisponivel.findUnique({
          where: { id: agendamento.horarioId },
        }),
        prisma.horarioFixo.findFirst({
          where: {
            membroId: agendamento.membroId,
            diaSemana: horario.diaSemana,
            hora: horario.horaInicio,
          },
          select: { id: true },
        }),
      ])

      if (!horarioAtual) {
        throwAgendamentoError('Horario atual nao encontrado')
      }

      const horarioFixoAtual = await prisma.horarioFixo.findFirst({
        where: {
          membroId: agendamento.membroId,
          diaSemana: horarioAtual.diaSemana,
          hora: horarioAtual.horaInicio,
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
          throwAgendamentoError(limitCheck.error)
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

      await prisma.agendamento.deleteMany({
        where: {
          membroId: agendamento.membroId,
          horarioId: agendamento.horarioId,
          data: { gte: selectedOccurrenceDate },
          id: { not: id },
        },
      })
    }

    if (horarioId) updateData.horario = { connect: { id: horarioId } }
    if (data) updateData.data = newData
  }

  return prisma.agendamento.update({
    where: { id },
    data: updateData,
    select: agendamentoSelect,
  })
}

export async function deleteAgendamento(params: DeleteAgendamentoParams) {
  const { id, scope } = params
  const deleteScope = scope ?? 'single'
  const agendamento = await prisma.agendamento.findUnique({
    where: { id },
    include: { horario: true },
  })

  if (!agendamento) {
    throwAgendamentoError('Agendamento nao encontrado', 404)
  }

  if (deleteScope === 'future') {
    const selectedOccurrenceDate = getOccurrenceDate(agendamento.data)

    await prisma.horarioFixo.deleteMany({
      where: {
        membroId: agendamento.membroId,
        diaSemana: agendamento.horario.diaSemana,
        hora: agendamento.horario.horaInicio,
      },
    })

    await prisma.agendamento.deleteMany({
      where: {
        membroId: agendamento.membroId,
        horarioId: agendamento.horarioId,
        data: { gte: selectedOccurrenceDate },
      },
    })
  } else {
    await prisma.agendamento.delete({
      where: { id },
    })
  }
}

export async function syncAgendamentosRecorrentes({
  startDate,
  endDate,
  membroId,
}: SyncRecurringParams) {
  const start = normalizeDate(startDate)
  const end = normalizeDate(endDate)

  if (start > end) {
    return { created: 0 }
  }

  const horariosFixos = await prisma.horarioFixo.findMany({
    where: {
      membro: {
        status: StatusMembro.ATIVO,
        ...(membroId ? { id: membroId } : {}),
      },
    },
    select: {
      membroId: true,
      diaSemana: true,
      hora: true,
    },
  })

  if (!horariosFixos.length) {
    return { created: 0 }
  }

  const slots = new Map<string, { diaSemana: DiaSemana; hora: string }>()
  for (const horario of horariosFixos) {
    slots.set(slotKey(horario.diaSemana, horario.hora), {
      diaSemana: horario.diaSemana,
      hora: horario.hora,
    })
  }

  const slotFilters: Prisma.HorarioDisponivelWhereInput[] = Array.from(slots.values()).map(
    (slot) => ({
      diaSemana: slot.diaSemana,
      horaInicio: slot.hora,
      ativo: true,
    })
  )

  const horariosExistentes = slotFilters.length
    ? await prisma.horarioDisponivel.findMany({
        where: { OR: slotFilters },
        select: {
          id: true,
          diaSemana: true,
          horaInicio: true,
          vagasTotal: true,
        },
      })
    : []

  const horariosMap = new Map<string, { id: string; vagasTotal: number }>()
  for (const horario of horariosExistentes) {
    horariosMap.set(slotKey(horario.diaSemana, horario.horaInicio), {
      id: horario.id,
      vagasTotal: horario.vagasTotal,
    })
  }

  const missingSlots = Array.from(slots.values()).filter(
    (slot) => !horariosMap.has(slotKey(slot.diaSemana, slot.hora))
  )

  if (missingSlots.length) {
    await prisma.horarioDisponivel.createMany({
      data: missingSlots.map((slot) => ({
        diaSemana: slot.diaSemana,
        horaInicio: slot.hora,
        horaFim: buildHoraFim(slot.hora),
        vagasTotal: MAX_CAPACITY_PER_SLOT,
      })),
      skipDuplicates: true,
    })

    const refreshedHorarios = await prisma.horarioDisponivel.findMany({
      where: { OR: slotFilters },
      select: {
        id: true,
        diaSemana: true,
        horaInicio: true,
        vagasTotal: true,
      },
    })

    for (const horario of refreshedHorarios) {
      horariosMap.set(slotKey(horario.diaSemana, horario.horaInicio), {
        id: horario.id,
        vagasTotal: horario.vagasTotal,
      })
    }
  }

  const datesByDay = new Map<number, Date[]>()
  const cursor = new Date(start)
  while (cursor <= end) {
    const day = cursor.getDay()
    const list = datesByDay.get(day) ?? []
    list.push(new Date(cursor))
    datesByDay.set(day, list)
    cursor.setDate(cursor.getDate() + 1)
  }

  const horarioIds = new Set<string>()
  for (const horario of horariosFixos) {
    const mapped = horariosMap.get(slotKey(horario.diaSemana, horario.hora))
    if (mapped) {
      horarioIds.add(mapped.id)
    }
  }

  if (!horarioIds.size) {
    return { created: 0 }
  }

  const agendamentosExistentes = await prisma.agendamento.findMany({
    where: {
      data: {
        gte: start,
        lte: end,
      },
      horarioId: { in: Array.from(horarioIds) },
    },
    select: {
      membroId: true,
      horarioId: true,
      data: true,
    },
  })

  const existingKeys = new Set<string>()
  const countsBySlot = new Map<string, number>()

  for (const agendamento of agendamentosExistentes) {
    const dateKey = getDateKey(agendamento.data)
    existingKeys.add(`${agendamento.membroId}-${agendamento.horarioId}-${dateKey}`)
    const slotCountKey = `${agendamento.horarioId}-${dateKey}`
    countsBySlot.set(slotCountKey, (countsBySlot.get(slotCountKey) ?? 0) + 1)
  }

  const createData: Prisma.AgendamentoCreateManyInput[] = []

  for (const horarioFixo of horariosFixos) {
    const slot = horariosMap.get(slotKey(horarioFixo.diaSemana, horarioFixo.hora))
    if (!slot) continue

    const targetDates = datesByDay.get(
      {
        DOMINGO: 0,
        SEGUNDA: 1,
        TERCA: 2,
        QUARTA: 3,
        QUINTA: 4,
        SEXTA: 5,
        SABADO: 6,
      }[horarioFixo.diaSemana]
    )

    if (!targetDates?.length) continue

    for (const date of targetDates) {
      const dateKey = getDateKey(date)
      const existingKey = `${horarioFixo.membroId}-${slot.id}-${dateKey}`
      if (existingKeys.has(existingKey)) continue

      const slotCountKey = `${slot.id}-${dateKey}`
      const currentCount = countsBySlot.get(slotCountKey) ?? 0

      if (currentCount >= slot.vagasTotal) {
        continue
      }

      createData.push({
        membroId: horarioFixo.membroId,
        horarioId: slot.id,
        data: normalizeDate(date),
      })
      existingKeys.add(existingKey)
      countsBySlot.set(slotCountKey, currentCount + 1)
    }
  }

  if (!createData.length) {
    return { created: 0 }
  }

  await prisma.agendamento.createMany({
    data: createData,
    skipDuplicates: true,
  })

  return { created: createData.length }
}
