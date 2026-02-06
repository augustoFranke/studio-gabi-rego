import { describe, expect, it } from 'vitest'
import { exercicioSchema, fichaCreateSchema, fichaUpdateSchema, treinoTemplateSchema, trainingPdfSchema } from '@/schemas/treino.schema'

describe('treino schemas', () => {
  it('exercicioSchema coerces series to string and defaults sessao', () => {
    const result = exercicioSchema.safeParse({ nome: 'Supino', series: 4, repeticoes: '10' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.series).toBe('4')
      expect(result.data.sessao).toBe('A')
    }
  })

  it('treinoTemplateSchema requires nome', () => {
    const result = treinoTemplateSchema.safeParse({ nome: '' })

    expect(result.success).toBe(false)
  })

  it('trainingPdfSchema accepts sessions with numeric sets/reps', () => {
    const result = trainingPdfSchema.safeParse({
      aluno: 'Aluno',
      date: '01/2026',
      sessions: [
        {
          name: 'A',
          exercises: [{ name: 'Supino', sets: 3, reps: 12 }],
        },
      ],
    })

    expect(result.success).toBe(true)
  })

  describe('date format MM/AAAA validation', () => {
    it('fichaCreateSchema accepts valid MM/AAAA format', () => {
      expect(fichaCreateSchema.safeParse({ data: '01/2025' }).success).toBe(true)
      expect(fichaCreateSchema.safeParse({ data: '12/2030' }).success).toBe(true)
    })

    it('fichaCreateSchema rejects invalid date formats', () => {
      expect(fichaCreateSchema.safeParse({ data: '1/2025' }).success).toBe(false)
      expect(fichaCreateSchema.safeParse({ data: '13/2025' }).success).toBe(false)
      expect(fichaCreateSchema.safeParse({ data: '00/2025' }).success).toBe(false)
      expect(fichaCreateSchema.safeParse({ data: '01/25' }).success).toBe(false)
      expect(fichaCreateSchema.safeParse({ data: '2025/01' }).success).toBe(false)
      expect(fichaCreateSchema.safeParse({ data: '01-2025' }).success).toBe(false)
    })

    it('fichaCreateSchema allows empty/undefined data', () => {
      expect(fichaCreateSchema.safeParse({}).success).toBe(true)
      expect(fichaCreateSchema.safeParse({ data: undefined }).success).toBe(true)
    })

    it('fichaUpdateSchema validates date format the same way', () => {
      expect(fichaUpdateSchema.safeParse({ data: '06/2025' }).success).toBe(true)
      expect(fichaUpdateSchema.safeParse({ data: 'invalid' }).success).toBe(false)
    })
  })
})
