import { describe, expect, it } from 'vitest'
import { addDaysYmd, formatBrFromYmd, getYmdInTimeZone } from '@/lib/dates'

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
})
