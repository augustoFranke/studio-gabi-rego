export function normalizeCpf(value?: string | null): string | null {
  return value ? value.replace(/\D/g, '') : null
}

export function normalizeTelefone(value?: string | null): string | null {
  return value ? value.replace(/\D/g, '') : null
}

export function normalizeOptionalString(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null

  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export function parseOptionalDate(value?: string | null): Date | null {
  if (value === undefined || value === null || value.trim() === '') {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}
