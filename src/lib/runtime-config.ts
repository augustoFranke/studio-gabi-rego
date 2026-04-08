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
 * these. Missing provider credentials degrade the relevant integration (email,
 * WhatsApp, rate limiting) but do not block startup.
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

  // --- Provider: Evolution (WhatsApp) ---
  EVOLUTION_API_URL: z.string().optional(),
  EVOLUTION_API_KEY: z.string().optional(),
  EVOLUTION_INSTANCE: z.string().optional(),
  WHATSAPP_COUNTRY_CODE: z.string().default('55'),

  // --- Provider: Upstash (Rate Limiting) ---
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // --- Deployment ---
  DEPLOYMENT_TARGET: z.string().optional(),
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

  if (!config.EVOLUTION_API_URL || !config.EVOLUTION_API_KEY || !config.EVOLUTION_INSTANCE) {
    warnings.push('Evolution API not fully configured — WhatsApp delivery is disabled')
  }

  if (!config.UPSTASH_REDIS_REST_URL || !config.UPSTASH_REDIS_REST_TOKEN) {
    if (config.NODE_ENV === 'production') {
      warnings.push(
        'Upstash not configured in production — rate limiting will deny requests (fail-closed)',
      )
    } else {
      warnings.push('Upstash not configured — rate limiting disabled (fail-open in dev)')
    }
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
  whatsapp: boolean
  rateLimit: boolean
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
    whatsapp: Boolean(
      process.env.EVOLUTION_API_URL &&
      process.env.EVOLUTION_API_KEY &&
      process.env.EVOLUTION_INSTANCE,
    ),
    rateLimit: Boolean(
      process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
    ),
  }
}
