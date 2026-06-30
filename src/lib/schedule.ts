import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  addDays,
  isSameDay,
  getDay,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { DiaSemana } from '@/types/schedule'

export {
  DiaSemanaMap,
  DiaSemanaLabel,
  DiaSemanaAbrev,
  getDiaSemanaFromDay,
} from '@/lib/dias-semana'

export const SCHEDULE_START_HOUR = 5
export const SCHEDULE_END_HOUR = 20
export const MAX_CAPACITY_PER_SLOT = 10

export const HOURS = Array.from(
  { length: SCHEDULE_END_HOUR - SCHEDULE_START_HOUR },
  (_, i) => SCHEDULE_START_HOUR + i
)

export interface TimeSlot {
  hour: number
  label: string
}

export interface ScheduleEvent {
  id: string
  membroId: string
  membroNome: string
  horarioId: string
  data: Date
  horaInicio: string
  horaFim: string
  presente: boolean | null
  observacao: string | null
}

export interface DaySchedule {
  date: Date
  diaSemana: DiaSemana
  slots: Map<number, ScheduleEvent[]>
}

export function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`
}

export function isSchedulableHour(hour: number): boolean {
  return Number.isInteger(hour) && hour >= SCHEDULE_START_HOUR && hour < SCHEDULE_END_HOUR
}

export function isSchedulableHourString(timeString: string): boolean {
  return /^\d{2}:00$/.test(timeString) && isSchedulableHour(parseHourFromString(timeString))
}

export function buildScheduleEndTime(horaInicio: string): string {
  const hour = parseHourFromString(horaInicio)
  return formatHour(hour + 1)
}

export function parseHourFromString(timeString: string): number {
  return parseInt(timeString.split(':')[0], 10)
}

function groupByMap<T, K>(items: T[], getKey: (item: T) => K): Map<K, T[]> {
  const grouped = new Map<K, T[]>()

  for (const item of items) {
    const key = getKey(item)
    const existing = grouped.get(key)
    if (existing) {
      existing.push(item)
    } else {
      grouped.set(key, [item])
    }
  }

  return grouped
}

export function getTimeSlots(): TimeSlot[] {
  return HOURS.map((hour) => ({
    hour,
    label: formatHour(hour),
  }))
}

export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 })
  return eachDayOfInterval({
    start,
    end: addDays(start, 5),
  })
}

export function getMonthDays(date: Date): Date[] {
  return eachDayOfInterval({
    start: startOfMonth(date),
    end: endOfMonth(date),
  })
}

export function getCalendarDays(date: Date): Date[] {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  return eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  })
}

export function getCalendarDaysMonSat(date: Date): Date[] {
  const allDays = getCalendarDays(date)
  return allDays.filter((day) => getDay(day) !== 0)
}

export function formatDateBR(date: Date): string {
  return format(date, 'dd/MM/yyyy', { locale: ptBR })
}

export function formatDateISO(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function parseDateFromAPI(dateValue: Date | string): Date {
  if (!dateValue) return new Date(NaN)

  const dateStr =
    typeof dateValue === 'string'
      ? dateValue
      : Number.isNaN(dateValue.getTime())
        ? ''
        : dateValue.toISOString()

  if (!dateStr) {
    return new Date(NaN)
  }

  const datePart = dateStr.split('T')[0]
  const [year, month, day] = datePart.split('-').map(Number)

  if (!year || !month || !day) return new Date(NaN)

  return new Date(year, month - 1, day, 12, 0, 0)
}

export function parseLocalDate(dateString: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(year, month - 1, day, 12, 0, 0)
  }
  return new Date(dateString)
}

export function formatDayMonth(date: Date): string {
  return format(date, 'dd/MM', { locale: ptBR })
}

export function formatWeekdayShort(date: Date): string {
  return format(date, 'EEE', { locale: ptBR })
}

export function formatWeekdayFull(date: Date): string {
  return format(date, 'EEEE', { locale: ptBR })
}

export function formatMonthYear(date: Date): string {
  return format(date, 'MMMM yyyy', { locale: ptBR })
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

export function navigateDay(date: Date, direction: 'prev' | 'next'): Date {
  return direction === 'next' ? addDays(date, 1) : addDays(date, -1)
}

export function navigateWeek(date: Date, direction: 'prev' | 'next'): Date {
  return direction === 'next' ? addWeeks(date, 1) : subWeeks(date, 1)
}

export function navigateMonth(date: Date, direction: 'prev' | 'next'): Date {
  return direction === 'next' ? addMonths(date, 1) : subMonths(date, 1)
}

export function groupEventsByHour(events: ScheduleEvent[]): Map<number, ScheduleEvent[]> {
  return groupByMap(events, (event) => parseHourFromString(event.horaInicio))
}

export function groupEventsByDateAndHour(
  events: ScheduleEvent[]
): Map<string, Map<number, ScheduleEvent[]>> {
  const groupedByDate = groupByMap(events, (event) => formatDateISO(event.data))
  const grouped = new Map<string, Map<number, ScheduleEvent[]>>()

  for (const [dateKey, dateEvents] of groupedByDate) {
    grouped.set(dateKey, groupEventsByHour(dateEvents))
  }

  return grouped
}

export function countEventsByDate(events: ScheduleEvent[]): Map<string, number> {
  const groupedByDate = groupByMap(events, (event) => formatDateISO(event.data))
  const counts = new Map<string, number>()

  for (const [dateKey, dateEvents] of groupedByDate) {
    counts.set(dateKey, dateEvents.length)
  }

  return counts
}

export function hasCapacity(currentCount: number): boolean {
  return currentCount < MAX_CAPACITY_PER_SLOT
}

export function getSlotCapacityInfo(currentCount: number): {
  available: number
  total: number
  isFull: boolean
  percentage: number
} {
  return {
    available: Math.max(0, MAX_CAPACITY_PER_SLOT - currentCount),
    total: MAX_CAPACITY_PER_SLOT,
    isFull: currentCount >= MAX_CAPACITY_PER_SLOT,
    percentage: Math.min(100, (currentCount / MAX_CAPACITY_PER_SLOT) * 100),
  }
}
