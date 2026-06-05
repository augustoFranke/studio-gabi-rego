import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// We need to test validateRuntimeConfig which reads process.env directly,
// so we manipulate env before each test.

describe('Runtime Config', () => {
  const originalEnv = { ...process.env }
  const runtimeConfigEnvKeys = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'AUTH_SECRET',
    'CRON_SECRET',
    'APP_TIMEZONE',
    'NEXTAUTH_URL',
    'NEXT_PUBLIC_APP_URL',
    'RESEND_API_KEY',
    'VERCEL',
    'VERCEL_URL',
    'CORS_ALLOWED_ORIGIN',
    'RUN_MIGRATIONS',
    'DIRECT_URL',
  ] as const

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    for (const key of runtimeConfigEnvKeys) {
      delete process.env[key]
    }
  })

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv }
  })

  async function importModule() {
    return import('@/lib/runtime-config')
  }

  function setMinimalValidEnv() {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
    process.env.NEXTAUTH_SECRET = 'test-secret-at-least-1-char'
    process.env.CRON_SECRET = 'test-cron-secret'
  }

  it('passes validation with all critical variables set', async () => {
    setMinimalValidEnv()
    const { validateRuntimeConfig } = await importModule()
    const result = validateRuntimeConfig()

    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.config).not.toBeNull()
    expect(result.config!.DATABASE_URL).toBe('postgresql://test:test@localhost:5432/test')
  })

  it('fails validation when DATABASE_URL is missing', async () => {
    process.env.NEXTAUTH_SECRET = 'test-secret'
    process.env.CRON_SECRET = 'test-cron-secret'
    delete process.env.DATABASE_URL
    const { validateRuntimeConfig } = await importModule()
    const result = validateRuntimeConfig()

    expect(result.ok).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors.join(' ')).toContain('DATABASE_URL')
  })

  it('fails validation when CRON_SECRET is missing', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
    process.env.NEXTAUTH_SECRET = 'test-secret'
    delete process.env.CRON_SECRET
    const { validateRuntimeConfig } = await importModule()
    const result = validateRuntimeConfig()

    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('CRON_SECRET')
  })

  it('fails when neither NEXTAUTH_SECRET nor AUTH_SECRET is set', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
    process.env.CRON_SECRET = 'test-cron-secret'
    delete process.env.NEXTAUTH_SECRET
    delete process.env.AUTH_SECRET
    const { validateRuntimeConfig } = await importModule()
    const result = validateRuntimeConfig()

    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('NEXTAUTH_SECRET')
  })

  it('passes when AUTH_SECRET is set instead of NEXTAUTH_SECRET', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
    process.env.AUTH_SECRET = 'auth-secret-value'
    process.env.CRON_SECRET = 'test-cron-secret'
    delete process.env.NEXTAUTH_SECRET
    const { validateRuntimeConfig } = await importModule()
    const result = validateRuntimeConfig()

    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('warns when Resend is not configured', async () => {
    setMinimalValidEnv()
    delete process.env.RESEND_API_KEY
    const { validateRuntimeConfig } = await importModule()
    const result = validateRuntimeConfig()

    expect(result.ok).toBe(true)
    expect(result.warnings).toContain('RESEND_API_KEY not set — email delivery is disabled')
  })

  it('defaults APP_TIMEZONE to America/Sao_Paulo', async () => {
    setMinimalValidEnv()
    delete process.env.APP_TIMEZONE
    const { validateRuntimeConfig } = await importModule()
    const result = validateRuntimeConfig()

    expect(result.ok).toBe(true)
    expect(result.config!.APP_TIMEZONE).toBe('America/Sao_Paulo')
  })

  it('getConfigReadiness returns correct summary', async () => {
    setMinimalValidEnv()
    process.env.RESEND_API_KEY = 're_test'
    const { getConfigReadiness } = await importModule()
    const readiness = getConfigReadiness()

    expect(readiness.database).toBe(true)
    expect(readiness.auth).toBe(true)
    expect(readiness.cron).toBe(true)
    expect(readiness.email).toBe(true)
  })
})
