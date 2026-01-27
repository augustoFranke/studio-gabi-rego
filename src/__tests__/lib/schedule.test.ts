import { describe, expect, it } from 'vitest'
import {
  MAX_CAPACITY_PER_SLOT,
  getSlotCapacityInfo,
  getWeekDays,
  groupEventsByDateAndHour,
  parseDateFromAPI,
  parseLocalDate,
  type ScheduleEvent,
} from '@/lib/schedule'

describe('schedule utilities', () => {
  it('parseLocalDate keeps the correct calendar day and sets noon', () => {
    const date = parseLocalDate('2025-01-20')

    expect(date.getFullYear()).toBe(2025)
    expect(date.getMonth()).toBe(0)
    expect(date.getDate()).toBe(20)
    expect(date.getHours()).toBe(12)
  })

  it('parseDateFromAPI extracts the date portion safely', () => {
    const date = parseDateFromAPI('2025-01-20T00:00:00.000Z')

    expect(date.getFullYear()).toBe(2025)
    expect(date.getMonth()).toBe(0)
    expect(date.getDate()).toBe(20)
    expect(date.getHours()).toBe(12)
  })

  it('parseDateFromAPI returns an invalid date for bad inputs', () => {
    const date = parseDateFromAPI('not-a-date')
    expect(Number.isNaN(date.getTime())).toBe(true)
  })

  it('getWeekDays returns Monday through Saturday only', () => {
    const wednesday = new Date(2025, 0, 22, 12, 0, 0) // Wed Jan 22, 2025
    const days = getWeekDays(wednesday)

    expect(days).toHaveLength(6)
    expect(days[0].getDay()).toBe(1)
    expect(days[5].getDay()).toBe(6)
    expect(days[0].getDate()).toBe(20)
    expect(days[5].getDate()).toBe(25)
  })

  it('groupEventsByDateAndHour groups by date key and start hour', () => {
    const baseDate = new Date(2025, 0, 20, 12, 0, 0)
    const nextDate = new Date(2025, 0, 21, 12, 0, 0)

    const events: ScheduleEvent[] = [
      {
        id: 'e-1',
        membroId: 'm-1',
        membroNome: 'Aluno 1',
        horarioId: 'h-1',
        data: baseDate,
        horaInicio: '09:00',
        horaFim: '10:00',
        presente: null,
        observacao: null,
      },
      {
        id: 'e-2',
        membroId: 'm-2',
        membroNome: 'Aluno 2',
        horarioId: 'h-1',
        data: baseDate,
        horaInicio: '09:30',
        horaFim: '10:30',
        presente: null,
        observacao: null,
      },
      {
        id: 'e-3',
        membroId: 'm-3',
        membroNome: 'Aluno 3',
        horarioId: 'h-2',
        data: nextDate,
        horaInicio: '10:00',
        horaFim: '11:00',
        presente: null,
        observacao: null,
      },
    ]

    const grouped = groupEventsByDateAndHour(events)

    const day1 = grouped.get('2025-01-20')
    const day2 = grouped.get('2025-01-21')

    expect(day1?.get(9)).toHaveLength(2)
    expect(day2?.get(10)).toHaveLength(1)
  })

  it('getSlotCapacityInfo handles boundaries and caps percentage at 100', () => {
    const empty = getSlotCapacityInfo(0)
    expect(empty.available).toBe(MAX_CAPACITY_PER_SLOT)
    expect(empty.isFull).toBe(false)
    expect(empty.percentage).toBe(0)

    const full = getSlotCapacityInfo(MAX_CAPACITY_PER_SLOT)
    expect(full.available).toBe(0)
    expect(full.isFull).toBe(true)
    expect(full.percentage).toBe(100)

    const over = getSlotCapacityInfo(MAX_CAPACITY_PER_SLOT + 5)
    expect(over.available).toBe(0)
    expect(over.percentage).toBe(100)
  })
})
