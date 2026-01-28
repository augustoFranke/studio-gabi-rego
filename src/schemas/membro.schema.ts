import { z } from 'zod'

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
  hora: z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido'),
})

export const membroCreateSchema = z.object({
  nome: z.string().optional(),
  email: z.string().email('Por favor, forneça um email válido.').optional().or(z.literal('')),
  senha: z.string().optional(),
  cpf: z.string().nullable().optional().or(z.literal('')),
  rg: z.string().optional(),
  telefone: z.string().optional(),
  dataNascimento: z.string().optional(),
  planoId: z.string().optional(),
  precoCustomizado: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((val) => {
      if (val === '') return null
      if (typeof val === 'string') return Number(val)
      return val
    }),
  sexo: z
    .union([z.enum(['MASCULINO', 'FEMININO']), z.literal('')])
    .optional()
    .transform((val) => {
      if (val === '') return undefined
      return val
    }),
  horariosFixos: z.array(horarioFixoSchema).optional(),
})

export const membroUpdateSchema = z.object({
  nome: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').optional().or(z.literal('')),
  cpf: z.string().nullable().optional().or(z.literal('')),
  rg: z.string().optional(),
  telefone: z.string().optional(),
  dataNascimento: z.string().optional(),
  planoId: z.string().optional(),
  precoCustomizado: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((val) => {
      if (val === '' || val === null) return null
      return Number(val)
    }),
  sexo: z
    .union([z.enum(['MASCULINO', 'FEMININO']), z.literal('')])
    .optional()
    .transform((val) => {
      if (val === '') return undefined
      return val
    }),
  horariosFixos: z.array(horarioFixoSchema).optional(),
})

export type MembroCreateInput = z.infer<typeof membroCreateSchema>
export type MembroUpdateInput = z.infer<typeof membroUpdateSchema>
