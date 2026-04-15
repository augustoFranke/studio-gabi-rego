const DEFAULT_APP_TIMEZONE = 'America/Sao_Paulo'

export function getAppTimezone(): string {
  return process.env.APP_TIMEZONE || DEFAULT_APP_TIMEZONE
}

function normalizeDateInput(date: Date | string | number): Date {
  const normalized =
    date instanceof Date
      ? date
      : typeof date === 'string' || typeof date === 'number'
        ? new Date(date)
        : new Date(NaN)

  if (Number.isNaN(normalized.getTime())) {
    throw new RangeError('Invalid time value')
  }

  return normalized
}

export function getYmdInTimeZone(date: Date | string | number, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(normalizeDateInput(date))
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  if (!year || !month || !day) {
    throw new Error('Invalid date parts')
  }

  return `${year}-${month}-${day}`
}

export function getTimeHmInTimeZone(date: Date | string | number, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  return formatter.format(normalizeDateInput(date))
}

export function getDateFromYmd(ymd: string): Date {
  const [year, month, day] = ymd.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0)
}

export function combineYmdAndTime(ymd: string, time: string): string {
  return `${ymd} ${time}`
}

export function addDaysYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number)
  const base = Date.UTC(year, month - 1, day)
  const next = new Date(base + days * 24 * 60 * 60 * 1000)
  return next.toISOString().slice(0, 10)
}

export function formatBrFromYmd(ymd: string): string {
  const [year, month, day] = ymd.split('-')
  return `${day}/${month}/${year}`
}

/**
 * Format input as MM/AAAA (treino date format)
 * Auto-inserts slash after 2 digits
 */
export function formatTreinoDate(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 6)
  if (digits.length <= 2) {
    return digits
  }
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

/**
 * Validates treino date format MM/AAAA
 * Returns true if valid (month 01-12, 4-digit year)
 */
export function isValidTreinoDate(value: string): boolean {
  return /^(0[1-9]|1[0-2])\/\d{4}$/.test(value)
}
