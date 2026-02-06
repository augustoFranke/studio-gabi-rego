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
  data: treinoDateSchema.optional(),
  objetivo: z.string().optional(),
  observacoes: z.string().optional(),
  exercicios: z.array(exercicioSchema).optional(),
})

export const fichaUpdateSchema = z.object({
  nome: z.string().optional(),
  data: treinoDateSchema.optional(),
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
