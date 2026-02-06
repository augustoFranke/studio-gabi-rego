import { describe, expect, it } from 'vitest'
import { addDaysYmd, formatBrFromYmd, formatTreinoDate, getYmdInTimeZone, isValidTreinoDate } from '@/lib/dates'

describe('dates helpers', () => {
  it('adds days to ymd', () => {
    expect(addDaysYmd('2026-02-04', 1)).toBe('2026-02-05')
  })

  it('formats ymd to BR format', () => {
    expect(formatBrFromYmd('2026-02-05')).toBe('05/02/2026')
  })

  it('gets ymd in timezone', () => {
    const date = new Date('2026-02-04T02:30:00Z')
    expect(getYmdInTimeZone(date, 'America/Sao_Paulo')).toBe('2026-02-03')
  })

  describe('formatTreinoDate', () => {
    it('strips non-digits and auto-inserts slash', () => {
      expect(formatTreinoDate('012025')).toBe('01/2025')
      expect(formatTreinoDate('01/2025')).toBe('01/2025')
      expect(formatTreinoDate('12')).toBe('12')
      expect(formatTreinoDate('1')).toBe('1')
    })

    it('limits to 6 digits', () => {
      expect(formatTreinoDate('0120251234')).toBe('01/2025')
    })
  })

  describe('isValidTreinoDate', () => {
    it('accepts valid MM/AAAA', () => {
      expect(isValidTreinoDate('01/2025')).toBe(true)
      expect(isValidTreinoDate('12/2030')).toBe(true)
    })

    it('rejects invalid months', () => {
      expect(isValidTreinoDate('00/2025')).toBe(false)
      expect(isValidTreinoDate('13/2025')).toBe(false)
    })

    it('rejects invalid formats', () => {
      expect(isValidTreinoDate('1/2025')).toBe(false)
      expect(isValidTreinoDate('01/25')).toBe(false)
      expect(isValidTreinoDate('2025/01')).toBe(false)
      expect(isValidTreinoDate('')).toBe(false)
    })
  })
})
