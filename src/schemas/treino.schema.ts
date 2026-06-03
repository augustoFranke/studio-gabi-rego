import { z } from 'zod'

/**
 * Date format: MM/AAAA (e.g., 01/2025)
 * Validates month (01-12) and year (4 digits)
 */
const treinoDateSchema = z
  .string()
  .regex(/^(0[1-9]|1[0-2])\/\d{4}$/, 'Data deve estar no formato MM/AAAA')

export const exercicioSchema = z.object({
  id: z.string().optional(),
  sessao: z.string().max(20).default('A'),
  nome: z.string().max(120).optional(),
  grupoMuscular: z.string().max(80).optional(),
  series: z.union([z.string().max(40), z.number()]).transform((val) => String(val)).optional(),
  repeticoes: z.string().max(80).optional(),
  descanso: z.string().max(80).optional(),
  observacoes: z.string().max(500).optional(),
})

export const fichaCreateSchema = z.object({
  membroId: z.string().optional(),
  nome: z.string().max(120).optional(),
  data: treinoDateSchema.optional(),
  objetivo: z.string().max(500).optional(),
  observacoes: z.string().max(1000).optional(),
  exercicios: z.array(exercicioSchema).max(120).optional(),
})

export const fichaUpdateSchema = z.object({
  nome: z.string().max(120).optional(),
  data: treinoDateSchema.optional(),
  objetivo: z.string().max(500).optional(),
  observacoes: z.string().max(1000).optional(),
  exercicios: z.array(exercicioSchema).max(120).optional(),
})

export const treinoTemplateSchema = z.object({
  nome: z.string().min(1).max(120),
  objetivo: z.string().max(500).optional(),
  observacoes: z.string().max(1000).optional(),
  fichaId: z.string().optional(),
  exercicios: z.array(exercicioSchema).max(120).optional(),
})

export const trainingPdfSchema = z.object({
  aluno: z.string().trim().min(1).max(120).optional(),
  date: z.string().trim().min(1).max(30).optional(),
  observacoes: z.string().max(1000).optional(),
  sessions: z
    .array(
      z.object({
        name: z.string().max(40),
        exercises: z.array(
          z.object({
            name: z.string().max(120),
            sets: z.union([z.string().max(40), z.number()]),
            reps: z.union([z.string().max(80), z.number()]),
          })
        ).max(40),
      })
    )
    .max(8)
    .optional(),
})

export type ExercicioInput = z.infer<typeof exercicioSchema>
export type FichaCreateInput = z.infer<typeof fichaCreateSchema>
export type FichaUpdateInput = z.infer<typeof fichaUpdateSchema>
export type TreinoTemplateInput = z.infer<typeof treinoTemplateSchema>
export type TrainingPdfInput = z.infer<typeof trainingPdfSchema>
