import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  RUNTIME_CONFIG_DEGRADED,
  RUNTIME_CONFIG_INVALID,
  RUNTIME_CONFIG_VALID,
} from '@/lib/observability/events'

const {
  logInfoMock,
  logWarnMock,
  logErrorMock,
  registerShutdownHandlersMock,
} = vi.hoisted(() => ({
  logInfoMock: vi.fn(),
  logWarnMock: vi.fn(),
  logErrorMock: vi.fn(),
  registerShutdownHandlersMock: vi.fn(),
}))

vi.mock('@/lib/observability/logger', () => ({
  logInfo: logInfoMock,
  logWarn: logWarnMock,
  logError: logErrorMock,
}))

vi.mock('@/lib/shutdown', () => ({
  registerShutdownHandlers: registerShutdownHandlersMock,
}))

describe('instrumentation runtime validation', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = {
      ...originalEnv,
      NEXT_RUNTIME: 'nodejs',
    }
  })

  function setMinimalValidEnv() {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
    process.env.NEXTAUTH_SECRET = 'test-secret'
    process.env.CRON_SECRET = 'cron-secret'
  }

  it('throws before startup when critical config is missing', async () => {
    delete process.env.DATABASE_URL
    delete process.env.NEXTAUTH_SECRET
    delete process.env.AUTH_SECRET
    delete process.env.CRON_SECRET

    const { register } = await import('@/instrumentation')

    await expect(register()).rejects.toThrow('Critical configuration is missing or invalid')
    expect(logErrorMock).toHaveBeenCalledWith(RUNTIME_CONFIG_INVALID, {
      errors: expect.arrayContaining([
        expect.stringContaining('DATABASE_URL'),
        expect.stringContaining('CRON_SECRET'),
      ]),
    })
    expect(registerShutdownHandlersMock).not.toHaveBeenCalled()
  })

  it('logs degraded startup when optional integrations are missing', async () => {
    setMinimalValidEnv()
    delete process.env.RESEND_API_KEY
    delete process.env.EVOLUTION_API_URL
    delete process.env.EVOLUTION_API_KEY
    delete process.env.EVOLUTION_INSTANCE

    const { register } = await import('@/instrumentation')

    await expect(register()).resolves.toBeUndefined()
    expect(logWarnMock).toHaveBeenCalledWith(RUNTIME_CONFIG_DEGRADED, {
      warnings: expect.arrayContaining([
        'RESEND_API_KEY not set — email delivery is disabled',
        'Evolution API not fully configured — WhatsApp delivery is disabled',
      ]),
    })
    expect(registerShutdownHandlersMock).toHaveBeenCalledTimes(1)
  })

  it('logs healthy startup when required and optional config are all present', async () => {
    setMinimalValidEnv()
    process.env.RESEND_API_KEY = 're_test'
    process.env.EVOLUTION_API_URL = 'https://evolution.test'
    process.env.EVOLUTION_API_KEY = 'evolution-key'
    process.env.EVOLUTION_INSTANCE = 'studio'
    process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.test'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'upstash-token'

    const { register } = await import('@/instrumentation')

    await expect(register()).resolves.toBeUndefined()
    expect(logInfoMock).toHaveBeenCalledWith(RUNTIME_CONFIG_VALID, {})
    expect(registerShutdownHandlersMock).toHaveBeenCalledTimes(1)
  })
})
