import { StatusPagamento } from '@prisma/client'
import { z } from 'zod'

const requiredString = (message: string) => z.string().min(1, message)

export const pagamentoCreateSchema = z.object({
  membroId: requiredString('Selecione um aluno'),
  planoId: requiredString('Selecione um plano'),
  valor: z.number().positive('Valor deve ser maior que zero'),
  dataVencimento: requiredString('Informe a data de vencimento'),
  formaPagamento: requiredString('Selecione a forma de pagamento'),
  observacao: z.string().nullable().optional(),
})

export const pagamentosQuerySchema = z.object({
  membroId: z.string().min(1).nullable(),
  status: z.union([z.nativeEnum(StatusPagamento), z.literal('all')]).nullable(),
  search: z.string().trim().max(120).nullable(),
  sort: z.enum(['recent_desc', 'vencimento_asc', 'vencimento_desc']).catch('recent_desc'),
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(10),
})

export type PagamentoCreateInput = z.infer<typeof pagamentoCreateSchema>
export type PagamentosQueryInput = z.infer<typeof pagamentosQuerySchema>
