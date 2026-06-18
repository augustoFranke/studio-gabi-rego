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
// API route errors
// ---------------------------------------------------------------------------

export const PLANO_CREATE_FAILED = 'plano_create_failed' as const
export const PLANO_UPDATE_FAILED = 'plano_update_failed' as const
export const PLANO_DELETE_FAILED = 'plano_delete_failed' as const
export const PAGAMENTO_LIST_FAILED = 'pagamento_list_failed' as const
export const PAGAMENTO_UPDATE_FAILED = 'pagamento_update_failed' as const
export const PAGAMENTO_DELETE_FAILED = 'pagamento_delete_failed' as const
export const PERFIL_SAVE_FAILED = 'perfil_save_failed' as const
export const AUTH_RESEND_VERIFICATION_FAILED = 'auth_resend_verification_failed' as const
export const AUTH_SIGN_UP_FAILED = 'auth_sign_up_failed' as const
export const AUTH_PASSWORD_RESET_FAILED = 'auth_password_reset_failed' as const
export const ANAMNESE_TOKEN_FETCH_FAILED = 'anamnese_token_fetch_failed' as const
export const ANAMNESE_TOKEN_SAVE_FAILED = 'anamnese_token_save_failed' as const
export const ANAMNESE_FETCH_FAILED = 'anamnese_fetch_failed' as const
export const ANAMNESE_SAVE_FAILED = 'anamnese_save_failed' as const
export const HORARIO_CREATE_FAILED = 'horario_create_failed' as const
export const HORARIO_GET_OR_CREATE_FAILED = 'horario_get_or_create_failed' as const
export const MEMBRO_UPDATE_FAILED = 'membro_update_failed' as const
export const MEMBRO_PROFILE_LINK_FAILED = 'membro_profile_link_failed' as const
export const MEMBRO_ANAMNESE_LINK_FAILED = 'membro_anamnese_link_failed' as const
export const API_UNHANDLED_ERROR = 'api_unhandled_error' as const

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
  | typeof PLANO_CREATE_FAILED
  | typeof PLANO_UPDATE_FAILED
  | typeof PLANO_DELETE_FAILED
  | typeof PAGAMENTO_LIST_FAILED
  | typeof PAGAMENTO_UPDATE_FAILED
  | typeof PAGAMENTO_DELETE_FAILED
  | typeof PERFIL_SAVE_FAILED
  | typeof AUTH_RESEND_VERIFICATION_FAILED
  | typeof AUTH_SIGN_UP_FAILED
  | typeof AUTH_PASSWORD_RESET_FAILED
  | typeof ANAMNESE_TOKEN_FETCH_FAILED
  | typeof ANAMNESE_TOKEN_SAVE_FAILED
  | typeof ANAMNESE_FETCH_FAILED
  | typeof ANAMNESE_SAVE_FAILED
  | typeof HORARIO_CREATE_FAILED
  | typeof HORARIO_GET_OR_CREATE_FAILED
  | typeof MEMBRO_UPDATE_FAILED
  | typeof MEMBRO_PROFILE_LINK_FAILED
  | typeof MEMBRO_ANAMNESE_LINK_FAILED
  | typeof API_UNHANDLED_ERROR
