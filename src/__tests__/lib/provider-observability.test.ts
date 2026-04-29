import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PROVIDER_NOT_CONFIGURED,
  PROVIDER_SEND_ATTEMPTED,
  PROVIDER_SEND_FAILED,
  PROVIDER_SEND_OK,
} from '@/lib/observability/events'

type LoggedEvent = {
  event: string
  correlationId: string | null
  route: string | null
  provider?: string
  [key: string]: unknown
}

describe('provider observability', () => {
  const originalEnv = { ...process.env }
  const originalArgv = [...process.argv]
  const originalFetch = global.fetch
  const providerEnvKeys = [
    'RESEND_API_KEY',
    'EVOLUTION_API_URL',
    'EVOLUTION_API_KEY',
    'EVOLUTION_INSTANCE',
    'NEXTAUTH_SECRET',
    'AUTH_SECRET',
    'CRON_SECRET',
    'DATABASE_URL',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
  ] as const

  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    process.env = { ...originalEnv, NODE_ENV: 'development' }
    for (const key of providerEnvKeys) {
      delete process.env[key]
    }
    process.env.NODE_ENV = 'development'
    delete process.env.VITEST
    process.argv = ['node', 'provider-observability']
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    process.argv = [...originalArgv]
    global.fetch = originalFetch
  })

  function parseCalls(spy: ReturnType<typeof vi.spyOn>): LoggedEvent[] {
    return spy.mock.calls
      .map(([line]) => line)
      .filter((line): line is string => typeof line === 'string')
      .map((line) => JSON.parse(line) as LoggedEvent)
  }

  it('logs not-configured email provider events without secrets', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { enviarEmail } = await import('@/lib/resend')

    const result = await enviarEmail({
      para: 'user@example.com',
      assunto: 'Teste',
      html: '<p>Oi</p>',
    })

    expect(result).toEqual({
      success: false,
      error: 'Resend não configurado',
    })

    const logs = parseCalls(warnSpy)
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      event: PROVIDER_NOT_CONFIGURED,
      provider: 'resend',
      correlationId: null,
    })
    expect(JSON.stringify(logs[0])).not.toContain('RESEND_API_KEY')
  })

  it('logs resend attempt and success with correlation metadata', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    process.env.RESEND_API_KEY = 're_test_secret'

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 'email-123' }),
    }) as unknown as typeof fetch

    const { runWithExecutionContext } = await import('@/lib/observability/request-context')
    const { enviarEmail } = await import('@/lib/resend')

    await runWithExecutionContext(
      {
        source: 'request',
        route: '/api/notificacoes',
        correlationId: 'corr-resend-1',
      },
      () =>
        enviarEmail({
          para: 'user@example.com',
          assunto: 'Bem-vinda',
          html: '<p>Oi</p>',
        }),
    )

    const logs = parseCalls(logSpy)
    expect(logs).toHaveLength(2)
    expect(logs[0]).toMatchObject({
      event: PROVIDER_SEND_ATTEMPTED,
      correlationId: 'corr-resend-1',
      route: '/api/notificacoes',
      provider: 'resend',
    })
    expect(logs[1]).toMatchObject({
      event: PROVIDER_SEND_OK,
      correlationId: 'corr-resend-1',
      route: '/api/notificacoes',
      provider: 'resend',
      emailId: 'email-123',
    })
  })

  it('logs evolution attempt and failure with cron correlation metadata', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    process.env.EVOLUTION_API_URL = 'https://evolution.test'
    process.env.EVOLUTION_API_KEY = 'evolution-secret'
    process.env.EVOLUTION_INSTANCE = 'studio'

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: vi.fn().mockResolvedValue('downstream unavailable'),
    }) as unknown as typeof fetch

    const { runWithExecutionContext } = await import('@/lib/observability/request-context')
    const { sendWhatsappText } = await import('@/lib/whatsapp/evolution')

    await expect(
      runWithExecutionContext(
        {
          source: 'cron',
          route: '/api/cron/cobrancas-whatsapp',
          jobName: 'cobrancas-whatsapp',
          correlationId: 'corr-evolution-1',
        },
        () =>
          sendWhatsappText({
            to: '5511999999999',
            text: 'Mensagem de teste',
          }),
      ),
    ).rejects.toThrow('Evolution API error (503)')

    const infoLogs = parseCalls(logSpy)
    const errorLogs = parseCalls(errorSpy)

    expect(infoLogs).toHaveLength(1)
    expect(infoLogs[0]).toMatchObject({
      event: PROVIDER_SEND_ATTEMPTED,
      correlationId: 'corr-evolution-1',
      route: '/api/cron/cobrancas-whatsapp',
      provider: 'evolution',
    })

    expect(errorLogs).toHaveLength(1)
    expect(errorLogs[0]).toMatchObject({
      event: PROVIDER_SEND_FAILED,
      correlationId: 'corr-evolution-1',
      route: '/api/cron/cobrancas-whatsapp',
      provider: 'evolution',
      statusCode: 503,
    })
    expect(JSON.stringify(errorLogs[0])).not.toContain('evolution-secret')
  })
})
