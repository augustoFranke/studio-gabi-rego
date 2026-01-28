import { describe, expect, it } from 'vitest'
import { membroCreateSchema, membroUpdateSchema } from '@/schemas/membro.schema'

describe('membro schemas', () => {
  it('membroCreateSchema normalizes precoCustomizado and sexo', () => {
    const result = membroCreateSchema.safeParse({
      precoCustomizado: '150',
      sexo: '',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.precoCustomizado).toBe(150)
      expect(result.data.sexo).toBeUndefined()
    }
  })

  it('membroCreateSchema converts empty precoCustomizado to null', () => {
    const result = membroCreateSchema.safeParse({ precoCustomizado: '' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.precoCustomizado).toBeNull()
    }
  })

  it('membroUpdateSchema allows empty senha and keeps as empty', () => {
    const result = membroUpdateSchema.safeParse({ senha: '' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.senha).toBe('')
    }
  })

  it('membroUpdateSchema converts precoCustomizado null to null', () => {
    const result = membroUpdateSchema.safeParse({ precoCustomizado: null })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.precoCustomizado).toBeNull()
    }
  })
})
