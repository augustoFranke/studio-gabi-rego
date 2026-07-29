// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import type { RenderCounter } from './render-counter'
import type { FinanceiroStats, Pagamento, Plano, Membro } from '@/app/(admin)/financeiro/_components/types'

const hoisted = vi.hoisted(() => ({ rowCounter: null as RenderCounter | null }))

vi.mock('@/app/(admin)/financeiro/_components/pagamento-row', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/app/(admin)/financeiro/_components/pagamento-row')>()
  const { countRenders } = await import('./render-counter')
  const [PagamentoRow, counter] = countRenders(actual.PagamentoRow, (props) => props.pagamento.id)
  hoisted.rowCounter = counter
  return { ...actual, PagamentoRow }
})

const fetchWithTimeout = vi.fn()
vi.mock('@/lib/http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/http')>()
  return { ...actual, fetchWithTimeout }
})

const { FinanceiroClient } = await import('@/app/(admin)/financeiro/financeiro-client')

const PLANO = {
  id: 'plano-1',
  nome: 'Mensal',
  descricao: null,
  valor: 200,
  duracaoDias: 30,
  aulasSemanais: 3,
  ativo: true,
  _count: { membros: 2, pagamentos: 5 },
} as unknown as Plano

const PAGAMENTOS: Pagamento[] = Array.from({ length: 6 }, (_, i) =>
  ({
    id: `pagamento-${i}`,
    membroId: `membro-${i}`,
    planoId: 'plano-1',
    valor: 200,
    status: 'PENDENTE',
    dataVencimento: '2026-08-10',
    dataPagamento: null,
    formaPagamento: null,
    observacao: null,
    payerNome: null,
    membro: { usuario: { nome: `Aluno ${i}` } },
    plano: PLANO,
  }) as unknown as Pagamento
)

const STATS: FinanceiroStats = {
  totalPlanos: 1,
  pagamentosPendentes: 6,
  pagamentosAtrasados: 0,
  receitaMes: 1200,
}

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body } as unknown as Response
}

describe('FinanceiroClient re-renders', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    hoisted.rowCounter?.reset()
    fetchWithTimeout.mockImplementation(async (input: string) => {
      if (input.startsWith('/api/pagamentos')) {
        return jsonResponse({ data: PAGAMENTOS, meta: { page: 1, totalPages: 1 } })
      }
      return jsonResponse({})
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    fetchWithTimeout.mockReset()
  })

  it('does not re-render payment rows while typing in the search box', async () => {
    render(
      <FinanceiroClient initialPlanos={[PLANO]} initialMembros={[] as Membro[]} initialStats={STATS} />
    )

    await vi.advanceTimersByTimeAsync(400)
    await waitFor(() => expect(screen.getByText('Aluno 0')).toBeTruthy())

    hoisted.rowCounter!.reset()

    const search = screen.getByPlaceholderText('Buscar por nome...')
    fireEvent.change(search, { target: { value: 'A' } })
    fireEvent.change(search, { target: { value: 'Al' } })
    fireEvent.change(search, { target: { value: 'Alu' } })

    expect(hoisted.rowCounter!.total()).toBe(0)
  })
})
