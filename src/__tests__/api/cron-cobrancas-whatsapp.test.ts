import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/cron/cobrancas-whatsapp/route'

const { prismaMock } = vi.hoisted(() => {
  const { createPrismaMock } = globalThis.__testUtils
  return {
    prismaMock: createPrismaMock({
      pagamento: ['findMany'],
      notificacao: ['findFirst', 'create', 'update'],
    }),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

describe('Cron cobrancas WhatsApp', () => {
  const baseUrl = 'http://localhost:3000/api/cron/cobrancas-whatsapp'
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-04T10:00:00Z'))
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
    process.env.APP_TIMEZONE = 'America/Sao_Paulo'
    process.env.EVOLUTION_API_URL = 'http://evolution.test'
    process.env.EVOLUTION_API_KEY = 'evo-key'
    process.env.EVOLUTION_INSTANCE = 'studio'
    process.env.WHATSAPP_COUNTRY_CODE = '55'
  })

  afterEach(() => {
    vi.useRealTimers()
    global.fetch = originalFetch
  })

  const createRequest = (token?: string) =>
    new NextRequest(baseUrl, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })

  it('returns 401 when unauthorized', async () => {
    const res = await POST(createRequest())
    expect(res.status).toBe(401)
  })

  it('sends one message per member and returns 200 on success', async () => {
    const pagamentos = [
      {
        id: 'p1',
        valor: 100,
        dataVencimento: new Date('2026-02-05T12:00:00.000Z'),
        membroId: 'm1',
        membro: {
          id: 'm1',
          status: 'ATIVO',
          telefone: '11999999999',
          usuario: { nome: 'Ana' },
        },
      },
      {
        id: 'p2',
        valor: 80,
        dataVencimento: new Date('2026-02-05T12:00:00.000Z'),
        membroId: 'm1',
        membro: {
          id: 'm1',
          status: 'ATIVO',
          telefone: '11999999999',
          usuario: { nome: 'Ana' },
        },
      },
      {
        id: 'p3',
        valor: 50,
        dataVencimento: new Date('2026-02-05T12:00:00.000Z'),
        membroId: 'm2',
        membro: {
          id: 'm2',
          status: 'ATIVO',
          telefone: '11888888888',
          usuario: { nome: 'Bia' },
        },
      },
    ]

    prismaMock.pagamento.findMany.mockResolvedValueOnce(pagamentos)
    prismaMock.notificacao.findFirst.mockResolvedValue(null)
    prismaMock.notificacao.create.mockResolvedValue({ id: 'n-1', enviada: false })
    prismaMock.notificacao.update.mockResolvedValue({ id: 'n-1', enviada: false })

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const res = await POST(createRequest('test-secret'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.sent).toBe(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(prismaMock.notificacao.findFirst).toHaveBeenCalledTimes(2)
    expect(prismaMock.notificacao.create).toHaveBeenCalledTimes(2)
    expect(prismaMock.notificacao.update).toHaveBeenCalledTimes(2)
  })

  it('returns 500 when any send fails', async () => {
    prismaMock.pagamento.findMany.mockResolvedValueOnce([
      {
        id: 'p1',
        valor: 100,
        dataVencimento: new Date('2026-02-05T12:00:00.000Z'),
        membroId: 'm1',
        membro: {
          id: 'm1',
          status: 'ATIVO',
          telefone: '11999999999',
          usuario: { nome: 'Ana' },
        },
      },
      {
        id: 'p2',
        valor: 80,
        dataVencimento: new Date('2026-02-05T12:00:00.000Z'),
        membroId: 'm2',
        membro: {
          id: 'm2',
          status: 'ATIVO',
          telefone: '11888888888',
          usuario: { nome: 'Bia' },
        },
      },
    ])
    prismaMock.notificacao.findFirst.mockResolvedValue(null)
    prismaMock.notificacao.create.mockResolvedValue({ id: 'n-1', enviada: false })
    prismaMock.notificacao.update.mockResolvedValue({ id: 'n-1', enviada: false })

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({}) })
      .mockResolvedValueOnce({ ok: false, text: vi.fn().mockResolvedValue('error') })
    global.fetch = fetchMock as unknown as typeof fetch

    const res = await POST(createRequest('test-secret'))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.failed).toBe(1)
    expect(prismaMock.notificacao.update).toHaveBeenCalledTimes(1)
  })
})
