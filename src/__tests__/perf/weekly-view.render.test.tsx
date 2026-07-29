// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { RenderCounter } from './render-counter'
import { HOURS } from '@/lib/schedule'
import type { Agendamento } from '@/types/schedule'

const hoisted = vi.hoisted(() => ({ counter: null as RenderCounter | null }))

vi.mock('@/components/schedule/time-slot', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/schedule/time-slot')>()
  const { countRenders } = await import('./render-counter')
  const [TimeSlot, counter] = countRenders(actual.TimeSlot, (props) => `${props.hour}`)
  hoisted.counter = counter
  return { ...actual, TimeSlot }
})

const timeSlotRenders = {
  total: () => hoisted.counter!.total(),
  forKey: (key: string) => hoisted.counter!.forKey(key),
  reset: () => hoisted.counter!.reset(),
}

const { WeeklyView } = await import('@/components/schedule/weekly-view')
const { DailyView } = await import('@/components/schedule/daily-view')

const MONDAY = new Date(2026, 6, 27, 12, 0, 0)

function makeAgendamento(id: string, data: Date, hora: string): Agendamento {
  return {
    id,
    membroId: `membro-${id}`,
    horarioId: `horario-${id}`,
    data: data.toISOString(),
    presente: null,
    observacao: null,
    membro: { id: `membro-${id}`, fotoUrl: null, usuario: { nome: `Aluno ${id}` } },
    horario: {
      id: `horario-${id}`,
      diaSemana: 'SEGUNDA',
      horaInicio: hora,
      horaFim: hora,
      vagasTotal: 4,
    },
  }
}

const SLOTS_PER_RENDER = HOURS.length * 6

describe('WeeklyView re-renders', () => {
  beforeEach(() => {
    cleanup()
    timeSlotRenders.reset()
  })

  it('re-renders only occupied slots when the grid itself re-renders', () => {
    const agendamento = makeAgendamento('a', MONDAY, '08:00')
    const noop = () => {}

    const props = {
      date: MONDAY,
      isEditable: true,
      onSlotClick: noop,
      onMemberClick: noop,
      draggingId: null,
      onDragStart: noop,
      onDragEnd: noop,
      onDrop: noop,
    }

    // A fresh array of the same agendamentos defeats WeeklyView's own memo, so
    // the grid body genuinely re-runs — otherwise this asserts nothing about
    // the empty slots. It is also what SWR does on every revalidation.
    const { rerender } = render(<WeeklyView {...props} agendamentos={[agendamento]} />)

    expect(timeSlotRenders.total()).toBe(SLOTS_PER_RENDER)
    timeSlotRenders.reset()

    rerender(<WeeklyView {...props} agendamentos={[agendamento]} />)

    // Only the 08:00 Monday slot holds data; the other 89 keep a stable empty
    // array and must not re-render.
    expect(timeSlotRenders.total()).toBe(1)
    expect(timeSlotRenders.forKey('8')).toBe(1)
  })

  it('re-renders only the slot holding the dragged agendamento when a drag starts', () => {
    const agendamentos = [
      makeAgendamento('a', MONDAY, '08:00'),
      makeAgendamento('b', MONDAY, '09:00'),
    ]
    const noop = () => {}

    const props = {
      date: MONDAY,
      agendamentos,
      isEditable: true,
      onSlotClick: noop,
      onMemberClick: noop,
      onDragStart: noop,
      onDragEnd: noop,
      onDrop: noop,
    }

    const { rerender } = render(<WeeklyView {...props} draggingId={null} />)
    timeSlotRenders.reset()

    rerender(<WeeklyView {...props} draggingId="a" />)

    expect(timeSlotRenders.total()).toBe(1)
    expect(timeSlotRenders.forKey('8')).toBe(1)
  })
})

describe('DailyView re-renders', () => {
  beforeEach(() => {
    cleanup()
    timeSlotRenders.reset()
  })

  it('re-renders only the slot holding the dragged agendamento when a drag starts', () => {
    const noop = () => {}
    const props = {
      date: MONDAY,
      agendamentos: [makeAgendamento('a', MONDAY, '08:00')],
      isEditable: true,
      onSlotClick: noop,
      onMemberClick: noop,
      onDragStart: noop,
      onDragEnd: noop,
      onDrop: noop,
    }

    const { rerender } = render(<DailyView {...props} draggingId={null} />)
    expect(timeSlotRenders.total()).toBe(HOURS.length)
    timeSlotRenders.reset()

    rerender(<DailyView {...props} draggingId="a" />)

    expect(timeSlotRenders.total()).toBe(1)
    expect(timeSlotRenders.forKey('8')).toBe(1)
  })
})
