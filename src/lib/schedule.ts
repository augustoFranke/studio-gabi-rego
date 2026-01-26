import { DiaSemana } from '@prisma/client'
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

export const SCHEDULE_START_HOUR = 5
export const SCHEDULE_END_HOUR = 20
export const MAX_CAPACITY_PER_SLOT = 10

export const HOURS = Array.from(
  { length: SCHEDULE_END_HOUR - SCHEDULE_START_HOUR },
  (_, i) => SCHEDULE_START_HOUR + i
)

export const DiaSemanaMap: Record<DiaSemana, number> = {
  DOMINGO: 0,
  SEGUNDA: 1,
  TERCA: 2,
  QUARTA: 3,
  QUINTA: 4,
  SEXTA: 5,
  SABADO: 6,
}

export const DiaSemanaLabel: Record<DiaSemana, string> = {
  DOMINGO: 'Domingo',
  SEGUNDA: 'Segunda',
  TERCA: 'Terça',
  QUARTA: 'Quarta',
  QUINTA: 'Quinta',
  SEXTA: 'Sexta',
  SABADO: 'Sábado',
}

export const DiaSemanaAbrev: Record<DiaSemana, string> = {
  DOMINGO: 'Dom',
  SEGUNDA: 'Seg',
  TERCA: 'Ter',
  QUARTA: 'Qua',
  QUINTA: 'Qui',
  SEXTA: 'Sex',
  SABADO: 'Sáb',
}

// Get DiaSemana from JavaScript day number (0 = Sunday)
export function getDiaSemanaFromDay(dayNumber: number): DiaSemana {
  const map: Record<number, DiaSemana> = {
    0: 'DOMINGO',
    1: 'SEGUNDA',
    2: 'TERCA',
    3: 'QUARTA',
    4: 'QUINTA',
    5: 'SEXTA',
    6: 'SABADO',
  }
  return map[dayNumber]
}

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

export function parseHourFromString(timeString: string): number {
  return parseInt(timeString.split(':')[0], 10)
}

export function getTimeSlots(): TimeSlot[] {
  return HOURS.map((hour) => ({
    hour,
    label: formatHour(hour),
  }))
}

export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 }) // Monday
  // Return Monday-Saturday only (6 days), excluding Sunday
  return eachDayOfInterval({
    start,
    end: addDays(start, 5), // Saturday (Monday + 5 days)
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

// Get calendar days excluding Sundays (Monday-Saturday only)
export function getCalendarDaysMonSat(date: Date): Date[] {
  const allDays = getCalendarDays(date)
  // Filter out Sundays (day 0)
  return allDays.filter((day) => getDay(day) !== 0)
}

export function formatDateBR(date: Date): string {
  return format(date, 'dd/MM/yyyy', { locale: ptBR })
}

export function formatDateISO(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

// Parse a date from API response as local date (handles UTC conversion issue)
// When Prisma returns a Date field, it comes as UTC midnight which shifts day in negative UTC offsets
export function parseDateFromAPI(dateValue: Date | string): Date {
  if (!dateValue) return new Date(NaN) // Return Invalid Date if null/undefined
  
  try {
    const dateStr = typeof dateValue === 'string' ? dateValue : dateValue.toISOString()
    // Extract just the date part (yyyy-MM-dd) and create local date at noon
    const datePart = dateStr.split('T')[0]
    const [year, month, day] = datePart.split('-').map(Number)
    
    // Validate parsed values
    if (!year || !month || !day) return new Date(NaN) 
    
    return new Date(year, month - 1, day, 12, 0, 0)
  } catch (e) {
    console.error('Error parsing date:', dateValue, e)
    return new Date(NaN)
  }
}

/**
 * Parse a date string (YYYY-MM-DD) to a Date object without timezone shift.
 * This ensures the date represents the correct day regardless of server timezone.
 */
export function parseLocalDate(dateString: string): Date {
  // If it's just a date (yyyy-MM-dd), parse as local midnight
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(year, month - 1, day, 12, 0, 0) // noon to avoid timezone edge cases
  }
  // Otherwise parse as-is (ISO string with time)
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
  const grouped = new Map<number, ScheduleEvent[]>()

  for (const event of events) {
    const hour = parseHourFromString(event.horaInicio)
    if (!grouped.has(hour)) {
      grouped.set(hour, [])
    }
    grouped.get(hour)!.push(event)
  }

  return grouped
}

export function groupEventsByDateAndHour(
  events: ScheduleEvent[]
): Map<string, Map<number, ScheduleEvent[]>> {
  const grouped = new Map<string, Map<number, ScheduleEvent[]>>()

  for (const event of events) {
    const dateKey = formatDateISO(event.data)
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, new Map())
    }

    const hour = parseHourFromString(event.horaInicio)
    const dateMap = grouped.get(dateKey)!
    if (!dateMap.has(hour)) {
      dateMap.set(hour, [])
    }
    dateMap.get(hour)!.push(event)
  }

  return grouped
}

export function countEventsByDate(events: ScheduleEvent[]): Map<string, number> {
  const counts = new Map<string, number>()

  for (const event of events) {
    const dateKey = formatDateISO(event.data)
    counts.set(dateKey, (counts.get(dateKey) || 0) + 1)
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
