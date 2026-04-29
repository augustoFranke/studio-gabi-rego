import { DiaSemana } from '@prisma/client'
import { z } from 'zod'

export const fullHourSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):00$/, 'Informe uma hora cheia válida')

export const agendamentoCreateSchema = z.object({
  membroId: z.string().optional(),
  horarioId: z.string().optional(),
  diaSemana: z.nativeEnum(DiaSemana).optional(),
  horaInicio: fullHourSchema.optional(),
  data: z.string().optional(),
  scope: z.enum(['single', 'weekly']).optional(),
}).refine(
  (value) => Boolean(value.horarioId || (value.diaSemana && value.horaInicio)),
  { message: 'Horário não informado' }
)

export const agendamentoUpdateSchema = z.object({
  presente: z.boolean().optional(),
  observacao: z.string().optional(),
  horarioId: z.string().optional(),
  diaSemana: z.nativeEnum(DiaSemana).optional(),
  horaInicio: fullHourSchema.optional(),
  data: z.string().optional(),
  scope: z.enum(['single', 'future']).optional(),
}).refine(
  (value) => !value.horarioId || (!value.diaSemana && !value.horaInicio),
  { message: 'Informe horarioId ou diaSemana/horaInicio, não ambos' }
).refine(
  (value) => Boolean(value.horarioId || Boolean(value.diaSemana) === Boolean(value.horaInicio)),
  { message: 'Informe diaSemana e horaInicio juntos' }
)

const dateParamSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const agendamentosQuerySchema = z.object({
  membroId: z.string().min(1).nullable(),
  dataInicio: dateParamSchema,
  dataFim: dateParamSchema,
}).refine((value) => {
  const start = new Date(`${value.dataInicio}T00:00:00.000Z`)
  const end = new Date(`${value.dataFim}T00:00:00.000Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return false
  }

  return end.getTime() - start.getTime() <= 1000 * 60 * 60 * 24 * 45
}, 'Intervalo de datas inválido')

export type AgendamentoCreateInput = z.infer<typeof agendamentoCreateSchema>
export type AgendamentoUpdateInput = z.infer<typeof agendamentoUpdateSchema>
export type AgendamentosQueryInput = z.infer<typeof agendamentosQuerySchema>
