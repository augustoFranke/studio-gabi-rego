import { describe, expect, it } from 'vitest'
import { pagamentoCreateSchema, pagamentosQuerySchema } from '@/features/finance/contracts'
import {
  agendamentoCreateSchema,
  agendamentoUpdateSchema,
  agendamentosQuerySchema,
} from '@/features/scheduling/contracts'

describe('feature request contracts', () => {
  it('validates payment create payloads', () => {
    expect(pagamentoCreateSchema.safeParse({
      membroId: 'm-1',
      planoId: 'p-1',
      valor: 120,
      dataVencimento: '2026-05-10',
      formaPagamento: 'PIX',
      observacao: null,
    }).success).toBe(true)

    expect(pagamentoCreateSchema.safeParse({
      membroId: '',
      planoId: 'p-1',
      valor: 0,
      dataVencimento: '',
      formaPagamento: '',
    }).success).toBe(false)
  })

  it('bounds payment list pagination', () => {
    const parsed = pagamentosQuerySchema.safeParse({
      membroId: null,
      status: 'all',
      search: null,
      sort: 'unknown',
      page: '0',
      limit: '500',
    })

    expect(parsed.success).toBe(true)
    expect(parsed.data).toMatchObject({
      sort: 'recent_desc',
      page: 1,
      limit: 10,
    })
  })

  it('requires a concrete scheduling slot on create', () => {
    expect(agendamentoCreateSchema.safeParse({
      membroId: 'm-1',
      data: '2026-05-01',
    }).success).toBe(false)

    expect(agendamentoCreateSchema.safeParse({
      membroId: 'm-1',
      diaSemana: 'SEGUNDA',
      horaInicio: '08:00',
      data: '2026-05-01',
    }).success).toBe(true)
  })

  it('keeps scheduling update slot inputs unambiguous', () => {
    expect(agendamentoUpdateSchema.safeParse({
      horarioId: 'h-1',
      diaSemana: 'SEGUNDA',
      horaInicio: '08:00',
    }).success).toBe(false)

    expect(agendamentoUpdateSchema.safeParse({
      diaSemana: 'SEGUNDA',
    }).success).toBe(false)
  })

  it('limits schedule list date windows', () => {
    expect(agendamentosQuerySchema.safeParse({
      membroId: null,
      dataInicio: '2026-05-01',
      dataFim: '2026-05-31',
    }).success).toBe(true)

    expect(agendamentosQuerySchema.safeParse({
      membroId: null,
      dataInicio: '2026-05-01',
      dataFim: '2026-08-01',
    }).success).toBe(false)
  })
})
