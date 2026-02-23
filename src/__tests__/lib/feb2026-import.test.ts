import { describe, it, expect, vi } from 'vitest'
import {
  buildImportKey,
  executePaymentImportFromRows,
  findBestMatch,
  isNumericPago,
  normalizeForMatching,
  parseBrazilianAmount,
  type ParsedDocxRow,
} from '@/lib/payments/feb2026-import'

type FakePrisma = {
  membro: { findMany: ReturnType<typeof vi.fn> }
  plano: { findFirst: ReturnType<typeof vi.fn> }
  pagamento: {
    findUnique: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    deleteMany: ReturnType<typeof vi.fn>
  }
  pagamentoImportRun: {
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
  }
  pagamentoImportLog: { create: ReturnType<typeof vi.fn> }
  $transaction: ReturnType<typeof vi.fn>
}

function createFakePrisma() {
  const paymentsByImportKey = new Map<string, { id: string }>()
  let runCounter = 0

  const fakeTx = {
    membro: {
      findMany: vi.fn(async () => [
        { id: 'm1', planoId: 'pl1', usuario: { nome: 'Geni Stray' } },
        { id: 'm2', planoId: 'pl2', usuario: { nome: 'Maria Silva' } },
        { id: 'm3', planoId: 'pl2', usuario: { nome: 'Maria Souza' } },
      ]),
    },
    plano: {
      findFirst: vi.fn(async () => ({ id: 'pl-default' })),
    },
    pagamento: {
      findUnique: vi.fn(async ({ where }: { where: { importKey: string } }) => paymentsByImportKey.get(where.importKey) ?? null),
      create: vi.fn(async ({ data }: { data: { importKey: string } }) => {
        const id = `pay-${paymentsByImportKey.size + 1}`
        paymentsByImportKey.set(data.importKey, { id })
        return { id }
      }),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    pagamentoImportRun: {
      create: vi.fn(async () => {
        runCounter += 1
        return { id: `run-${runCounter}` }
      }),
      update: vi.fn(async () => ({ id: `run-${runCounter}` })),
      findUnique: vi.fn(async () => null),
    },
    pagamentoImportLog: {
      create: vi.fn(async () => ({ id: `log-${Math.random()}` })),
    },
    $transaction: vi.fn(),
  } as FakePrisma

  fakeTx.$transaction.mockImplementation(async (cb: (tx: FakePrisma) => Promise<unknown>) => cb(fakeTx))

  return { fakePrisma: fakeTx, paymentsByImportKey }
}

describe('feb2026 importer helpers', () => {
  it('parses brazilian amounts', () => {
    expect(parseBrazilianAmount('238,50')).toBe(238.5)
    expect(parseBrazilianAmount('1.238,90')).toBe(1238.9)
    expect(parseBrazilianAmount('328,5')).toBe(328.5)
    expect(parseBrazilianAmount('35,5')).toBe(35.5)
  })

  it('ignores non-numeric PAGO values', () => {
    expect(isNumericPago('PG FEV')).toBe(false)
    expect(isNumericPago('PG ATE MAIO')).toBe(false)
    expect(isNumericPago('PROD.')).toBe(false)
    expect(isNumericPago('======')).toBe(false)
    expect(isNumericPago('')).toBe(false)
  })

  it('normalizes names deterministically', () => {
    expect(normalizeForMatching('  Júlio (Casal)  ')).toBe('JULIO CASAL')
  })

  it('returns ambiguous result for close candidates', () => {
    const result = findBestMatch('Maria', [
      { membroId: 'm2', nome: 'Maria Silva', normalizedNome: 'MARIA SILVA', planoId: 'pl2' },
      { membroId: 'm3', nome: 'Maria Souza', normalizedNome: 'MARIA SOUZA', planoId: 'pl2' },
    ])

    expect(result.decision).toBe('ambiguous')
  })

  it('builds deterministic idempotency key', () => {
    const key1 = buildImportKey('2026-02', 'GENI STRAY', 238.5, 'lista.docx')
    const key2 = buildImportKey('2026-02', 'GENI STRAY', 238.5, 'lista.docx')
    const key3 = buildImportKey('2026-02', 'GENI STRAY', 239.5, 'lista.docx')

    expect(key1).toBe(key2)
    expect(key1).not.toBe(key3)
  })
})

describe('feb2026 importer apply mode', () => {
  it('does not duplicate payments on a second run (idempotent)', async () => {
    const { fakePrisma } = createFakePrisma()
    const rows: ParsedDocxRow[] = [
      { rowIndex: 2, rawName: 'GENI STRAY', rawPago: '238,50' },
    ]

    const first = await executePaymentImportFromRows({
      prisma: fakePrisma,
      parsedRows: rows,
      sourcePath: '/tmp/lista.docx',
      month: '2026-02',
      apply: true,
      batchId: 'batch-1',
    })

    const second = await executePaymentImportFromRows({
      prisma: fakePrisma,
      parsedRows: rows,
      sourcePath: '/tmp/lista.docx',
      month: '2026-02',
      apply: true,
      batchId: 'batch-2',
    })

    expect(first.inserted).toBe(1)
    expect(second.inserted).toBe(0)
    expect(second.skipped).toBe(1)
    expect(fakePrisma.pagamento.create).toHaveBeenCalledTimes(1)
  })

  it('inserts unmatched payment with null member and keeps payer name', async () => {
    const { fakePrisma } = createFakePrisma()
    const rows: ParsedDocxRow[] = [
      { rowIndex: 4, rawName: 'PAGADOR DESCONHECIDO', rawPago: '265,00' },
    ]

    const summary = await executePaymentImportFromRows({
      prisma: fakePrisma,
      parsedRows: rows,
      sourcePath: '/tmp/lista.docx',
      month: '2026-02',
      apply: true,
      batchId: 'batch-unmatched',
    })

    expect(summary.unmatched).toBe(1)
    expect(summary.inserted).toBe(1)

    const createCall = vi.mocked(fakePrisma.pagamento.create).mock.calls[0]?.[0]
    expect(createCall.data.membroId).toBeNull()
    expect(createCall.data.payerNome).toBe('PAGADOR DESCONHECIDO')
  })
})
