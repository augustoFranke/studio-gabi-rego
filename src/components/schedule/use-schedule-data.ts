import { useMemo } from 'react'
import { formatDateISO, parseDateFromAPI, parseHourFromString } from '@/lib/schedule'
import type { Agendamento } from '@/types/schedule'

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
