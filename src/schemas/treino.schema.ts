import { z } from 'zod'

export const exercicioSchema = z.object({
  id: z.string().optional(),
  sessao: z.string().default('A'),
  nome: z.string().optional(),
  grupoMuscular: z.string().optional(),
  series: z.union([z.string(), z.number()]).transform((val) => String(val)).optional(),
  repeticoes: z.string().optional(),
  descanso: z.string().optional(),
  observacoes: z.string().optional(),
})

export const fichaCreateSchema = z.object({
  membroId: z.string().optional(),
  nome: z.string().optional(),
  data: z.string().optional(),
  objetivo: z.string().optional(),
  observacoes: z.string().optional(),
  exercicios: z.array(exercicioSchema).optional(),
})

export const fichaUpdateSchema = z.object({
  nome: z.string().optional(),
  data: z.string().optional(),
  objetivo: z.string().optional(),
  observacoes: z.string().optional(),
  exercicios: z.array(exercicioSchema).optional(),
})

export const treinoTemplateSchema = z.object({
  nome: z.string().min(1),
  objetivo: z.string().optional(),
  observacoes: z.string().optional(),
  fichaId: z.string().optional(),
  exercicios: z.array(exercicioSchema).optional(),
})

export const trainingPdfSchema = z.object({
  aluno: z.string().optional(),
  date: z.string().optional(),
  observacoes: z.string().optional(),
  sessions: z
    .array(
      z.object({
        name: z.string(),
        exercises: z.array(
          z.object({
            name: z.string(),
            sets: z.union([z.string(), z.number()]),
            reps: z.union([z.string(), z.number()]),
          })
        ),
      })
    )
    .optional(),
})

export type ExercicioInput = z.infer<typeof exercicioSchema>
export type FichaCreateInput = z.infer<typeof fichaCreateSchema>
export type FichaUpdateInput = z.infer<typeof fichaUpdateSchema>
export type TreinoTemplateInput = z.infer<typeof treinoTemplateSchema>
export type TrainingPdfInput = z.infer<typeof trainingPdfSchema>
