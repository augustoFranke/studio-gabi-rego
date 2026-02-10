import { prisma } from '@/lib/prisma'
import { DiaSemana, Prisma, StatusMembro } from '@prisma/client'
import { MAX_CAPACITY_PER_SLOT } from '@/lib/schedule'

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
    const createdHorarios = await prisma.$transaction(
      missingSlots.map((slot) =>
        prisma.horarioDisponivel.create({
          data: {
            diaSemana: slot.diaSemana,
            horaInicio: slot.hora,
            horaFim: buildHoraFim(slot.hora),
            vagasTotal: MAX_CAPACITY_PER_SLOT,
          },
          select: { id: true, diaSemana: true, horaInicio: true, vagasTotal: true },
        })
      )
    )

    for (const horario of createdHorarios) {
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
