import { describe, expect, it } from 'vitest'
import { formatWhatsappNumber } from '@/lib/whatsapp/evolution'

describe('formatWhatsappNumber', () => {
  it('adds country code for local numbers', () => {
    expect(formatWhatsappNumber('11999999999', '55')).toBe('5511999999999')
  })

  it('keeps numbers that already include country code', () => {
    expect(formatWhatsappNumber('5511999999999', '55')).toBe('5511999999999')
  })

  it('returns null for invalid length', () => {
    expect(formatWhatsappNumber('1234', '55')).toBeNull()
  })
})
