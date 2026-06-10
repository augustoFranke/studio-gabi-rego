/**
 * Typed runtime configuration contract.
 *
 * This module is the single source of truth for which environment variables the
 * app requires, which are optional, and what their shapes must be. It replaces
 * scattered `process.env` reads with one validated, typed object.
 *
 * ## Critical vs Optional
 *
 * **Critical** — the app must not serve traffic without these. A missing value
 * causes `validateRuntimeConfig()` to return errors.
 *
 * **Optional / provider** — the app can start and serve core routes without
 * these. Missing provider credentials degrade the relevant integration but do
 * not block startup.
 *
 * ## Usage
 *
 * Import `validateRuntimeConfig()` to validate once during startup and
 * `getConfigReadiness()` for safe operator-facing status checks:
 *
 * ```ts
 * import { validateRuntimeConfig, getConfigReadiness } from '@/lib/runtime-config'
 * ```
 *
 * Call `validateRuntimeConfig()` at startup (e.g. from `instrumentation.ts`)
 * to fail fast when critical config is missing.
 *
 * @module runtime-config
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const criticalSchema = z.object({
  /** PostgreSQL connection string. */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  /** Auth session signing secret. Falls back to AUTH_SECRET. */
  NEXTAUTH_SECRET: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(1).optional(),
  /** Bearer secret for cron route authentication. */
  CRON_SECRET: z.string().min(1, 'CRON_SECRET is required'),
})

const optionalSchema = z.object({
  /** Canonical app timezone. */
  APP_TIMEZONE: z.string().min(1).default('America/Sao_Paulo'),
  /** Auth callback URL. */
  NEXTAUTH_URL: z.string().optional(),
  /** Public-facing app URL. */
  NEXT_PUBLIC_APP_URL: z.string().optional(),

  // --- Provider: Resend (Email) ---
  RESEND_API_KEY: z.string().optional(),

  // --- Provider: Upstash Redis (rate limiting) ---
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // --- Deployment ---
  VERCEL: z.string().optional(),
  VERCEL_URL: z.string().optional(),
  CORS_ALLOWED_ORIGIN: z.string().optional(),
  RUN_MIGRATIONS: z.string().optional(),
  DIRECT_URL: z.string().optional(),
  NODE_ENV: z.string().optional(),
})

const runtimeConfigSchema = criticalSchema.merge(optionalSchema)

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ConfigValidationResult {
  ok: boolean
  config: RuntimeConfig | null
  errors: string[]
  warnings: string[]
}

/**
 * Validate the current `process.env` against the runtime config schema.
 *
 * Returns a result object rather than throwing so callers can decide how to
 * handle failures (log, exit, degrade, etc.).
 */
export function validateRuntimeConfig(): ConfigValidationResult {
  const warnings: string[] = []

  // Parse the full schema
  const result = runtimeConfigSchema.safeParse(process.env)

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    )
    return { ok: false, config: null, errors, warnings }
  }

  const config = result.data

  // --- Soft warnings for degraded integrations ---

  // Auth secret must exist in at least one form
  if (!config.NEXTAUTH_SECRET && !config.AUTH_SECRET) {
    return {
      ok: false,
      config: null,
      errors: ['Either NEXTAUTH_SECRET or AUTH_SECRET must be set'],
      warnings,
    }
  }

  // Provider warnings (not fatal)
  if (!config.RESEND_API_KEY) {
    warnings.push('RESEND_API_KEY not set — email delivery is disabled')
  }

  if (!config.UPSTASH_REDIS_REST_URL || !config.UPSTASH_REDIS_REST_TOKEN) {
    warnings.push(
      'UPSTASH_REDIS_REST_URL/TOKEN not set — rate limiting falls back to per-instance memory (ineffective on serverless)',
    )
  }

  return { ok: true, config, errors: [], warnings }
}

// ---------------------------------------------------------------------------
// Readiness summary (for health checks and operator visibility)
// ---------------------------------------------------------------------------

export interface ReadinessSummary {
  database: boolean
  auth: boolean
  cron: boolean
  email: boolean
}

export const DEFAULT_APP_TIMEZONE = 'America/Sao_Paulo'
export const DEFAULT_APP_BASE_URL = 'https://studiogabirego.com'

function normalizeBaseUrl(value?: string | null) {
  if (!value) return null

  try {
    const url = new URL(value)
    return url.origin
  } catch {
    return null
  }
}

export function getAppTimezoneConfig(): string {
  return process.env.APP_TIMEZONE || DEFAULT_APP_TIMEZONE
}

export function getAuthSecretConfig(): string | null {
  return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || null
}

export function getRequiredCronSecretConfig(): string | undefined {
  return process.env.CRON_SECRET || undefined
}

export function getEvolutionConfig() {
  return {
    url: process.env.EVOLUTION_API_URL,
    key: process.env.EVOLUTION_API_KEY,
    instance: process.env.EVOLUTION_INSTANCE,
  }
}

export function getRateLimitRedisConfig() {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  }
}

export function getEmailConfig() {
  return {
    resendApiKey: process.env.RESEND_API_KEY,
  }
}

export function isTestRuntime(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production'
}

export function isDevelopmentRuntime(): boolean {
  return process.env.NODE_ENV === 'development'
}

export function getAppBaseUrlConfig(origin?: string): string {
  const configuredUrl =
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeBaseUrl(process.env.NEXTAUTH_URL) ||
    normalizeBaseUrl(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)

  if (configuredUrl) return configuredUrl

  if (process.env.NODE_ENV !== 'production') {
    return normalizeBaseUrl(origin) || DEFAULT_APP_BASE_URL
  }

  return DEFAULT_APP_BASE_URL
}

/**
 * Return a safe readiness summary based on config presence.
 * Does NOT check live connectivity — only configuration completeness.
 */
export function getConfigReadiness(): ReadinessSummary {
  return {
    database: Boolean(process.env.DATABASE_URL),
    auth: Boolean(process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET),
    cron: Boolean(process.env.CRON_SECRET),
    email: Boolean(process.env.RESEND_API_KEY),
  }
}
