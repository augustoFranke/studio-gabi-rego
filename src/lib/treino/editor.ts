export const EXERCISE_HISTORY_KEY = 'gabi-studio-exercise-history'

export type ExerciseField = 'name' | 'sets' | 'reps'

type Exercise = { id: string; name: string; sets: string; reps: string }
type Session = { id: string; name: string; description: string; exercises: Exercise[] }

type ReadStorage = Pick<Storage, 'getItem'>
type WriteStorage = Pick<Storage, 'setItem'>

export function loadExerciseHistory(
  storage: ReadStorage,
  onError?: (error: unknown) => void
): { history: string[]; stored: boolean; parsed: boolean } {
  const stored = storage.getItem(EXERCISE_HISTORY_KEY)
  if (!stored) return { history: [], stored: false, parsed: false }
  try {
    return { history: JSON.parse(stored), stored: true, parsed: true }
  } catch (error) {
    onError?.(error)
    return { history: [], stored: true, parsed: false }
  }
}

export function saveExerciseHistory(storage: WriteStorage, history: string[]): void {
  storage.setItem(EXERCISE_HISTORY_KEY, JSON.stringify(history))
}

export function addSession(name: string): Session {
  return { id: crypto.randomUUID(), name, description: '', exercises: [] }
}

export function reindexSessions(sessions: Session[]): Session[] {
  return sessions.map((s, idx) => ({ ...s, name: String.fromCharCode(65 + idx) }))
}

export function addExercise(): Exercise {
  return { id: crypto.randomUUID(), name: '', sets: '', reps: '' }
}

export function updateExercise(exercise: Exercise, field: ExerciseField, value: string): Exercise {
  return { ...exercise, [field]: value }
}

export function removeExercise(exercises: Exercise[], exerciseId: string): Exercise[] {
  return exercises.filter((e) => e.id !== exerciseId)
}
