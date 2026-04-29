import { describe, expect, it } from 'vitest'
import { safeJsonParse } from '@/lib/safe-json'

describe('safeJsonParse', () => {
  it('returns parsed data for valid JSON', () => {
    expect(safeJsonParse('{"ok":true}')).toEqual({ ok: true, data: { ok: true } })
  })

  it('returns a failure result instead of throwing', () => {
    expect(safeJsonParse('{broken')).toEqual({ ok: false })
  })
})
