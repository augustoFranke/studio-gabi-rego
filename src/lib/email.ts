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
