import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EXERCISE_HISTORY_KEY,
  addExercise,
  addSession,
  loadExerciseHistory,
  removeExercise,
  reindexSessions,
  saveExerciseHistory,
  updateExercise,
} from '@/lib/treino/editor'

const makeStorage = (value: string | null) => ({
  getItem: vi.fn().mockReturnValue(value),
  setItem: vi.fn(),
})

describe('treino editor helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('loadExerciseHistory returns empty when nothing stored', () => {
    const storage = makeStorage(null)

    const result = loadExerciseHistory(storage)

    expect(result).toEqual({ history: [], stored: false, parsed: false })
  })

  it('loadExerciseHistory handles invalid JSON and calls onError', () => {
    const storage = makeStorage('invalid-json')
    const onError = vi.fn()

    const result = loadExerciseHistory(storage, onError)

    expect(result).toEqual({ history: [], stored: true, parsed: false })
    expect(onError).toHaveBeenCalled()
  })

  it('loadExerciseHistory returns parsed history', () => {
    const storage = makeStorage('["A","B"]')

    const result = loadExerciseHistory(storage)

    expect(result).toEqual({ history: ['A', 'B'], stored: true, parsed: true })
  })

  it('saveExerciseHistory persists JSON', () => {
    const storage = makeStorage(null)

    saveExerciseHistory(storage, ['X', 'Y'])

    expect(storage.setItem).toHaveBeenCalledWith(EXERCISE_HISTORY_KEY, '["X","Y"]')
  })

  it('addSession uses randomUUID and defaults', () => {
    const randomUUID = vi.fn().mockReturnValue('uuid-1')
    vi.stubGlobal('crypto', { randomUUID })

    const session = addSession('A')

    expect(session).toEqual({ id: 'uuid-1', name: 'A', description: '', exercises: [] })
  })

  it('reindexSessions renames sessions to letters', () => {
    const sessions = [
      { id: '1', name: 'X', description: '', exercises: [] },
      { id: '2', name: 'Y', description: '', exercises: [] },
    ]

    const result = reindexSessions(sessions)

    expect(result[0].name).toBe('A')
    expect(result[1].name).toBe('B')
  })

  it('addExercise uses randomUUID', () => {
    const randomUUID = vi.fn().mockReturnValue('uuid-2')
    vi.stubGlobal('crypto', { randomUUID })

    const exercise = addExercise()

    expect(exercise).toEqual({ id: 'uuid-2', name: '', sets: '', reps: '' })
  })

  it('updateExercise updates the selected field', () => {
    const exercise = { id: 'e-1', name: 'Supino', sets: '3', reps: '10' }

    const updated = updateExercise(exercise, 'sets', '4')

    expect(updated).toEqual({ ...exercise, sets: '4' })
    expect(updated).not.toBe(exercise)
  })

  it('removeExercise filters by id', () => {
    const exercises = [
      { id: 'e-1', name: '', sets: '', reps: '' },
      { id: 'e-2', name: '', sets: '', reps: '' },
    ]

    const result = removeExercise(exercises, 'e-1')

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('e-2')
  })
})
