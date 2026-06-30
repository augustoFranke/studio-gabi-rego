import { z } from 'zod'
import { passwordPolicySchema } from '@/schemas/password-policy.schema'
import { isSchedulableHourString } from '@/lib/schedule'

const diaSemanaSchema = z.enum([
  'SEGUNDA',
  'TERCA',
  'QUARTA',
  'QUINTA',
  'SEXTA',
  'SABADO',
  'DOMINGO',
])

const horarioFixoSchema = z.object({
  diaSemana: diaSemanaSchema,
  hora: z.string().refine(isSchedulableHourString, 'Horário inválido'),
})

const sexoSchema = z
  .union([z.enum(['MASCULINO', 'FEMININO']), z.literal('')])
  .optional()
  .transform((val) => {
    if (val === '') return undefined
    return val
  })

const baseSchema = z.object({
  nome: z.string().optional(),
  email: z.string().email('Por favor, forneça um email válido.').optional().or(z.literal('')),
  cpf: z.string().nullable().optional().or(z.literal('')),
  rg: z.string().optional(),
  telefone: z.string().optional(),
  dataNascimento: z.string().optional(),
  planoId: z.string().optional(),
  sexo: sexoSchema,
  horariosFixos: z.array(horarioFixoSchema).optional(),
})

const optionalPasswordSchema = z.union([z.literal(''), passwordPolicySchema]).optional()

export const membroCreateSchema = baseSchema.extend({
  senha: optionalPasswordSchema,
  precoCustomizado: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((val) => {
      if (val === '') return null
      if (typeof val === 'string') return Number(val)
      return val
    }),
})

export const membroUpdateSchema = baseSchema.extend({
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  senha: optionalPasswordSchema,
  precoCustomizado: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((val) => {
      if (val === '' || val === null) return null
      return Number(val)
    }),
})

export type MembroCreateInput = z.infer<typeof membroCreateSchema>
export type MembroUpdateInput = z.infer<typeof membroUpdateSchema>
