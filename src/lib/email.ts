const PLACEHOLDER_EMAIL_DOMAIN = "@placeholder.local"

export function normalizeEmail(email?: string | null): string | null {
  if (!email) return null

  const trimmed = email.trim()
  if (!trimmed) return null

  if (trimmed.endsWith(PLACEHOLDER_EMAIL_DOMAIN)) {
    return null
  }

  return trimmed
}

export function normalizeEmailForStorage(email?: string | null): string | null {
  const normalized = normalizeEmail(email)
  return normalized ? normalized.toLowerCase() : null
}

export function isPlaceholderEmail(email?: string | null): boolean {
  if (!email) return false
  return email.trim().toLowerCase().endsWith(PLACEHOLDER_EMAIL_DOMAIN)
}
