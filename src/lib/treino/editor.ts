import type {
  TreinoEditorExercise,
  TreinoEditorSession,
} from '@/domain/treino'

export type {
  TreinoEditorExercise,
  TreinoEditorSession,
} from '@/domain/treino'

export const EXERCISE_HISTORY_KEY = 'gabi-studio-exercise-history'

export type ExerciseField = 'name' | 'sets' | 'reps'

type ReadStorage = Pick<Storage, 'getItem'>
type WriteStorage = Pick<Storage, 'setItem'>

function parseExerciseHistory(stored: string): string[] {
  const parsed: unknown = JSON.parse(stored)

  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
    throw new Error('Invalid exercise history format')
  }

  return parsed
}

export function loadExerciseHistory(
  storage: ReadStorage,
  onError?: (error: Error) => void
): { history: string[]; stored: boolean; parsed: boolean } {
  const stored = storage.getItem(EXERCISE_HISTORY_KEY)
  if (!stored) return { history: [], stored: false, parsed: false }
  try {
    return { history: parseExerciseHistory(stored), stored: true, parsed: true }
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)))
    return { history: [], stored: true, parsed: false }
  }
}

export function saveExerciseHistory(storage: WriteStorage, history: string[]): void {
  storage.setItem(EXERCISE_HISTORY_KEY, JSON.stringify(history))
}

export function addSession(name: string): TreinoEditorSession {
  return { id: crypto.randomUUID(), name, description: '', exercises: [] }
}

export function reindexSessions(sessions: TreinoEditorSession[]): TreinoEditorSession[] {
  return sessions.map((s, idx) => ({ ...s, name: String.fromCharCode(65 + idx) }))
}

export function addExercise(): TreinoEditorExercise {
  return { id: crypto.randomUUID(), name: '', sets: '', reps: '' }
}

export function updateExercise(
  exercise: TreinoEditorExercise,
  field: ExerciseField,
  value: string
): TreinoEditorExercise {
  return { ...exercise, [field]: value }
}

export function removeExercise(
  exercises: TreinoEditorExercise[],
  exerciseId: string
): TreinoEditorExercise[] {
  return exercises.filter((e) => e.id !== exerciseId)
}
