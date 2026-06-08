import type {
  TreinoExercise,
  TreinoEditorExercise,
  TreinoEditorSession,
  TreinoTemplateExercise,
} from '@/domain/treino'

export type {
  TreinoEditorExercise,
  TreinoEditorSession,
} from '@/domain/treino'

export const EXERCISE_HISTORY_KEY = 'gabi-studio-exercise-history'

export type ExerciseField = 'name' | 'sets' | 'reps' | 'notes'

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

export function parseSessionName(fullName: string): { letter: string; description: string } {
  const match = fullName.match(/^([A-Z])(?:\s*-\s*(.*))?$/)
  if (match) {
    return { letter: match[1], description: match[2] || '' }
  }

  return { letter: fullName.charAt(0) || 'A', description: '' }
}

export function getFullSessionName(session: Pick<TreinoEditorSession, 'name' | 'description'>): string {
  return session.description.trim()
    ? `${session.name} - ${session.description.trim()}`
    : session.name
}

export function createEditorSessionsFromExercises(
  exercises: Array<Pick<TreinoExercise | TreinoTemplateExercise, 'id' | 'sessao' | 'nome' | 'series' | 'repeticoes' | 'observacoes'>>,
  createId: () => string = () => crypto.randomUUID()
): TreinoEditorSession[] {
  const sessionsMap = new Map<string, TreinoEditorExercise[]>()
  for (const exercise of exercises) {
    const sessionExercises = sessionsMap.get(exercise.sessao) || []
    sessionExercises.push({
      id: exercise.id,
      name: exercise.nome,
      sets: exercise.series,
      reps: exercise.repeticoes,
      notes: exercise.observacoes || '',
    })
    sessionsMap.set(exercise.sessao, sessionExercises)
  }

  const sessions = Array.from(sessionsMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fullName, sessionExercises]) => {
      const { letter, description } = parseSessionName(fullName)
      return {
        id: createId(),
        name: letter,
        description,
        exercises: sessionExercises,
      }
    })

  return sessions.length > 0
    ? sessions
    : [{ id: createId(), name: 'A', description: '', exercises: [] }]
}

export function mergeExerciseHistory(
  currentHistory: string[],
  sessions: TreinoEditorSession[]
): { history: string[]; changed: boolean } {
  const historySet = new Set(currentHistory)
  let changed = false

  for (const session of sessions) {
    for (const exercise of session.exercises) {
      const trimmed = exercise.name.trim()
      if (trimmed && !historySet.has(trimmed)) {
        historySet.add(trimmed)
        changed = true
      }
    }
  }

  return {
    history: changed ? [...historySet].toSorted() : currentHistory,
    changed,
  }
}

export function addExercise(): TreinoEditorExercise {
  return { id: crypto.randomUUID(), name: '', sets: '', reps: '', notes: '' }
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
