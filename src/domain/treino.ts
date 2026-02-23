export type TreinoExerciseInput = {
  id?: string
  sessao?: string
  nome?: string
  grupoMuscular?: string
  series?: string | number
  repeticoes?: string
  descanso?: string
  observacoes?: string
}

export type TreinoExercise = {
  id: string
  sessao: string
  nome: string
  grupoMuscular?: string | null
  series: string
  repeticoes: string
  descanso?: string | null
  observacoes?: string | null
  ordem?: number
}

export type TreinoFicha = {
  id: string
  nome: string
  data?: string | null
  objetivo?: string | null
  observacoes?: string | null
  membroId: string
  membro?: {
    id: string
    usuario: { nome: string }
  }
  exercicios: TreinoExercise[]
}

export type TreinoTemplateExercise = {
  id: string
  sessao: string
  nome: string
  grupoMuscular?: string | null
  series: string
  repeticoes: string
  descanso?: string | null
  observacoes?: string | null
  ordem?: number
}

export type TreinoTemplate = {
  id: string
  nome: string
  objetivo?: string | null
  observacoes?: string | null
  exercicios: TreinoTemplateExercise[]
}

export type TreinoEditorExercise = {
  id: string
  name: string
  sets: string
  reps: string
}

export type TreinoEditorSession = {
  id: string
  name: string
  description: string
  exercises: TreinoEditorExercise[]
}

export type TrainingPDFExercise = {
  name: string
  sets: string
  reps: string
  observacoes?: string
}

export type TrainingPDFSession = {
  name: string
  exercises: TrainingPDFExercise[]
}

export type TrainingPDFData = {
  aluno: string
  date: string
  observacoes?: string
  sessions: TrainingPDFSession[]
}
