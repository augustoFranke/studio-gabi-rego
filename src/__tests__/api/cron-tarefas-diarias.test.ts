import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/cron/tarefas-diarias/route'

const { executarTodasTarefasMock } = vi.hoisted(() => ({
  executarTodasTarefasMock: vi.fn(),
}))

vi.mock('@/lib/scheduler', () => ({
  executarTodasTarefas: executarTodasTarefasMock,
}))

describe('Cron tarefas diarias', () => {
  const baseUrl = 'http://localhost:3000/api/cron/tarefas-diarias'

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
  })

  const createRequest = (token?: string) =>
    new NextRequest(baseUrl, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })

  const createMalformedRequest = () =>
    new NextRequest(baseUrl, {
      method: 'POST',
      headers: { Authorization: 'Token malformed' },
    })

  it('returns 401 when unauthorized', async () => {
    const res = await POST(createRequest())
    expect(res.status).toBe(401)
  })

  it('returns 401 when authorization header is malformed', async () => {
    const res = await POST(createMalformedRequest())
    expect(res.status).toBe(401)
  })

  it('returns 401 when bearer token is invalid', async () => {
    const res = await POST(createRequest('wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns 500 when CRON_SECRET is missing', async () => {
    delete process.env.CRON_SECRET

    const res = await POST(createRequest('test-secret'))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('CRON_SECRET not configured')
  })

  it('runs scheduled tasks and returns summary', async () => {
    const startDate = new Date('2026-01-05T00:00:00.000Z')
    const endDate = new Date('2026-05-05T00:00:00.000Z')

    executarTodasTarefasMock.mockResolvedValueOnce({
      pagamentosAtualizados: 2,
      cobrancas: {
        targetDate: '2026-02-05',
        candidates: 3,
        sent: 2,
        skipped: 1,
        failed: 0,
      },
      aniversarios: {
        targetDate: '2026-02-04',
        candidates: 1,
        sent: 1,
        skipped: 0,
        failed: 0,
      },
      recorrencias: {
        created: 12,
        startDate,
        endDate,
      },
    })

    const res = await POST(createRequest('test-secret'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({
      pagamentosAtualizados: 2,
      cobrancas: {
        targetDate: '2026-02-05',
        candidates: 3,
        sent: 2,
        skipped: 1,
        failed: 0,
      },
      aniversarios: {
        targetDate: '2026-02-04',
        candidates: 1,
        sent: 1,
        skipped: 0,
        failed: 0,
      },
      recorrencias: {
        created: 12,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    })
    expect(executarTodasTarefasMock).toHaveBeenCalledTimes(1)
  })

  it('returns 500 when scheduler throws', async () => {
    executarTodasTarefasMock.mockRejectedValueOnce(new Error('boom'))

    const res = await POST(createRequest('test-secret'))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('boom')
  })

  it('returns 500 when any scheduled delivery summary reports failures', async () => {
    const startDate = new Date('2026-01-05T00:00:00.000Z')
    const endDate = new Date('2026-05-05T00:00:00.000Z')

    executarTodasTarefasMock.mockResolvedValueOnce({
      pagamentosAtualizados: 2,
      cobrancas: {
        targetDate: '2026-02-05',
        candidates: 3,
        sent: 2,
        skipped: 0,
        failed: 1,
      },
      aniversarios: {
        targetDate: '2026-02-04',
        candidates: 1,
        sent: 1,
        skipped: 0,
        failed: 0,
      },
      recorrencias: {
        created: 0,
        startDate,
        endDate,
      },
    })

    const res = await POST(createRequest('test-secret'))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.cobrancas.failed).toBe(1)
  })
})
