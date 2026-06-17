import { describe, expect, it } from 'vitest'
import { formatCurrency } from '@/lib/currency'

describe('formatCurrency', () => {
  it('formats a whole number with BRL symbol and pt-BR grouping', () => {
    const result = formatCurrency(1000)
    const expected = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(1000)
    expect(result).toBe(expected)
  })

  it('formats a decimal value to two fraction digits', () => {
    const result = formatCurrency(1234.56)
    const expected = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(1234.56)
    expect(result).toBe(expected)
  })

  it('formats a numeric string identically to its number form', () => {
    const numberResult = formatCurrency(1000)
    const stringResult = formatCurrency('1000')
    expect(stringResult).toBe(numberResult)
    expect(stringResult).toBe(
      new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(1000)
    )
  })
})
