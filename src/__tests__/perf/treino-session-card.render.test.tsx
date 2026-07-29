// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useCallback, useState } from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { RenderCounter } from './render-counter'
import { updateExercise as updateExerciseEditor, type ExerciseField } from '@/lib/treino/editor'
import type { TreinoEditorSession } from '@/domain/treino'

const hoisted = vi.hoisted(() => ({
  rowCounter: null as RenderCounter | null,
  cardCounter: null as RenderCounter | null,
}))

vi.mock('@/components/treino/exercise-row', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/treino/exercise-row')>()
  const { countRenders } = await import('./render-counter')
  const [ExerciseRow, counter] = countRenders(actual.ExerciseRow, (props) => props.exercise.id)
  hoisted.rowCounter = counter
  return { ...actual, ExerciseRow }
})

vi.mock('@/components/treino/session-card', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/treino/session-card')>()
  const { countRenders } = await import('./render-counter')
  const [SessionCard, counter] = countRenders(actual.SessionCard, (props) => props.session.id)
  hoisted.cardCounter = counter
  return { ...actual, SessionCard }
})

const { SessionCard } = await import('@/components/treino/session-card')

function makeSessions(): TreinoEditorSession[] {
  return ['A', 'B'].map((name, sessionIndex) => ({
    id: `session-${name}`,
    name,
    description: '',
    exercises: Array.from({ length: 3 }, (_, i) => ({
      id: `ex-${name}-${i}`,
      name: `Exercicio ${sessionIndex}-${i}`,
      sets: '3',
      reps: '10',
      notes: '',
    })),
  }))
}

/** Mirrors how the treino editor pages own and mutate session state. */
function Editor() {
  const [sessions, setSessions] = useState(makeSessions)
  const [unrelated, setUnrelated] = useState('')

  const handleExerciseChange = useCallback(
    (sessionId: string, exerciseId: string, field: ExerciseField, value: string) => {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                exercises: session.exercises.map((exercise) =>
                  exercise.id === exerciseId
                    ? updateExerciseEditor(exercise, field, value)
                    : exercise
                ),
              }
            : session
        )
      )
    },
    []
  )

  const noop = useCallback(() => {}, [])

  return (
    <div>
      <input
        aria-label="observacoes"
        value={unrelated}
        onChange={(event) => setUnrelated(event.target.value)}
      />
      {sessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          exerciseHistoryListId="exercises-list"
          onDescriptionChange={noop}
          onRemoveSession={noop}
          onAddExercise={noop}
          onExerciseChange={handleExerciseChange}
          onRemoveExercise={noop}
        />
      ))}
    </div>
  )
}

describe('treino editor re-renders', () => {
  beforeEach(() => {
    hoisted.rowCounter?.reset()
    hoisted.cardCounter?.reset()
  })

  afterEach(cleanup)

  it('re-renders only the edited exercise row when typing', () => {
    render(<Editor />)
    hoisted.rowCounter!.reset()
    hoisted.cardCounter!.reset()

    const input = screen.getAllByPlaceholderText('Nome do exercício...')[0]
    fireEvent.change(input, { target: { value: 'Supino' } })

    expect(hoisted.rowCounter!.forKey('ex-A-0')).toBe(1)
    expect(hoisted.rowCounter!.total()).toBe(1)
    expect(hoisted.cardCounter!.forKey('session-A')).toBe(1)
    expect(hoisted.cardCounter!.total()).toBe(1)
  })

  it('re-renders no session card when unrelated page state changes', () => {
    render(<Editor />)
    hoisted.rowCounter!.reset()
    hoisted.cardCounter!.reset()

    fireEvent.change(screen.getByLabelText('observacoes'), { target: { value: 'nota' } })

    expect(hoisted.cardCounter!.total()).toBe(0)
    expect(hoisted.rowCounter!.total()).toBe(0)
  })
})
