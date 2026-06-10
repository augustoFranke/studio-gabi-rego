/**
 * Shared operational event taxonomy.
 *
 * Every event emitted through the structured logger should use one of these
 * constants so operators can search, alert, and group by stable names instead
 * of arbitrary strings.
 *
 * Naming convention: `<domain>_<action>` using snake_case.
 *
 * @module observability/events
 */

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export const HEALTH_CHECK_OK = 'health_check_ok' as const
export const HEALTH_CHECK_FAILED = 'health_check_failed' as const

// ---------------------------------------------------------------------------
// Cron
// ---------------------------------------------------------------------------

export const CRON_RUN_STARTED = 'cron_run_started' as const
export const CRON_RUN_COMPLETED = 'cron_run_completed' as const
export const CRON_RUN_FAILED = 'cron_run_failed' as const
export const CRON_AUTH_FAILED = 'cron_auth_failed' as const

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const AUTH_SIGN_IN_FAILED = 'auth_sign_in_failed' as const
export const AUTH_SIGN_IN_OK = 'auth_sign_in_ok' as const
export const AUTH_VERIFICATION_FAILED = 'auth_verification_failed' as const
export const AUTH_VERIFICATION_OK = 'auth_verification_ok' as const
export const AUTH_SESSION_ERROR = 'auth_session_error' as const

// ---------------------------------------------------------------------------
// Notifications (email + whatsapp delivery layer)
// ---------------------------------------------------------------------------

export const NOTIFICATION_SEND_ATTEMPTED = 'notification_send_attempted' as const
export const NOTIFICATION_SEND_OK = 'notification_send_ok' as const
export const NOTIFICATION_SEND_FAILED = 'notification_send_failed' as const

// ---------------------------------------------------------------------------
// Provider (Resend / Evolution / external adapters)
// ---------------------------------------------------------------------------

export const PROVIDER_SEND_ATTEMPTED = 'provider_send_attempted' as const
export const PROVIDER_SEND_OK = 'provider_send_ok' as const
export const PROVIDER_SEND_FAILED = 'provider_send_failed' as const
export const PROVIDER_NOT_CONFIGURED = 'provider_not_configured' as const

// ---------------------------------------------------------------------------
// Runtime configuration
// ---------------------------------------------------------------------------

export const RUNTIME_CONFIG_VALID = 'runtime_config_valid' as const
export const RUNTIME_CONFIG_INVALID = 'runtime_config_invalid' as const
export const RUNTIME_CONFIG_DEGRADED = 'runtime_config_degraded' as const

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

export const RATE_LIMIT_BACKEND_ERROR = 'rate_limit_backend_error' as const

// ---------------------------------------------------------------------------
// Aggregate type
// ---------------------------------------------------------------------------

export type OperationalEvent =
  | typeof HEALTH_CHECK_OK
  | typeof HEALTH_CHECK_FAILED
  | typeof CRON_RUN_STARTED
  | typeof CRON_RUN_COMPLETED
  | typeof CRON_RUN_FAILED
  | typeof CRON_AUTH_FAILED
  | typeof AUTH_SIGN_IN_FAILED
  | typeof AUTH_SIGN_IN_OK
  | typeof AUTH_VERIFICATION_FAILED
  | typeof AUTH_VERIFICATION_OK
  | typeof AUTH_SESSION_ERROR
  | typeof NOTIFICATION_SEND_ATTEMPTED
  | typeof NOTIFICATION_SEND_OK
  | typeof NOTIFICATION_SEND_FAILED
  | typeof PROVIDER_SEND_ATTEMPTED
  | typeof PROVIDER_SEND_OK
  | typeof PROVIDER_SEND_FAILED
  | typeof PROVIDER_NOT_CONFIGURED
  | typeof RUNTIME_CONFIG_VALID
  | typeof RUNTIME_CONFIG_INVALID
  | typeof RUNTIME_CONFIG_DEGRADED
  | typeof RATE_LIMIT_BACKEND_ERROR
