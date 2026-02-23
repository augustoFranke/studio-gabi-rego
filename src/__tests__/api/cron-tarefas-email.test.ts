import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/cron/tarefas-email/route'

const { executarTodasTarefasMock } = vi.hoisted(() => ({
  executarTodasTarefasMock: vi.fn(),
}))

vi.mock('@/lib/scheduler', () => ({
  executarTodasTarefas: executarTodasTarefasMock,
}))

describe('Cron tarefas email', () => {
  const baseUrl = 'http://localhost:3000/api/cron/tarefas-email'

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
    executarTodasTarefasMock.mockResolvedValueOnce({
      pagamentosAtualizados: 2,
      lembretesAula: 1,
      cobrancas: 3,
      aniversarios: 1,
    })

    const res = await POST(createRequest('test-secret'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({
      pagamentosAtualizados: 2,
      lembretesAula: 1,
      cobrancas: 3,
      aniversarios: 1,
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
})
