import { useMemo } from 'react'
import { formatDateISO, parseDateFromAPI, parseHourFromString } from '@/lib/schedule'
import type { Agendamento } from '@/types/schedule'

// Shared instance so empty slots keep a stable `agendamentos` prop across renders.
export const NO_AGENDAMENTOS: Agendamento[] = []

/**
 * Narrows the globally dragged id to the slot that owns it, so starting or
 * ending a drag only invalidates that one slot instead of the whole grid.
 */
export function slotDraggingId(
  agendamentos: Agendamento[],
  draggingId: string | null | undefined
): string | null {
  if (!draggingId) return null
  return agendamentos.some((agendamento) => agendamento.id === draggingId) ? draggingId : null
}

export function useScheduleData(agendamentos: Agendamento[]) {
  return useMemo(() => {
    const byHour = new Map<number, Agendamento[]>()
    const byDate = new Map<string, Agendamento[]>()
    const byDateAndHour = new Map<string, Agendamento[]>()

    const pushToMap = <K, V>(map: Map<K, V[]>, key: K, value: V) => {
      const existing = map.get(key)
      if (existing) {
        existing.push(value)
      } else {
        map.set(key, [value])
      }
    }

    for (const agendamento of agendamentos) {
      const dateKey = formatDateISO(parseDateFromAPI(agendamento.data))
      const hour = parseHourFromString(agendamento.horario.horaInicio)

      pushToMap(byHour, hour, agendamento)
      pushToMap(byDate, dateKey, agendamento)
      pushToMap(byDateAndHour, `${dateKey}-${hour}`, agendamento)
    }

    const countsByDate = new Map<string, number>()
    for (const [dateKey, dayAgendamentos] of byDate) {
      countsByDate.set(dateKey, dayAgendamentos.length)
    }

    return {
      agendamentosByHour: byHour,
      agendamentosByDate: byDate,
      agendamentosByDateAndHour: byDateAndHour,
      countsByDate,
    }
  }, [agendamentos])
}
