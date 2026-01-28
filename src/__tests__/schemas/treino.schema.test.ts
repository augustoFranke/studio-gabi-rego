import { describe, expect, it } from 'vitest'
import { exercicioSchema, treinoTemplateSchema, trainingPdfSchema } from '@/schemas/treino.schema'

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
})
