import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/treinos/gerar-pdf/route'

const { sessionRef, generateTrainingPDFMock, withApiAuthMock } = vi.hoisted(() => {
  const { createSessionRef, mockWithApiAuth } = globalThis.__testUtils
  const sessionRef = createSessionRef({ user: { role: 'ADMIN' } })
  return {
    sessionRef,
    generateTrainingPDFMock: vi.fn(),
    withApiAuthMock: mockWithApiAuth(sessionRef).withApiAuth,
  }
})

vi.mock('@/lib/pdf', () => ({
  generateTrainingPDF: generateTrainingPDFMock,
}))

vi.mock('@/lib/api', () => ({
  withApiAuth: withApiAuthMock,
}))

describe('Treinos PDF API - POST /api/treinos/gerar-pdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionRef.current = { user: { role: 'ADMIN' } }
  })

  const createRequest = (body: Record<string, unknown>) =>
    new NextRequest('http://localhost:3000/api/treinos/gerar-pdf', {
      method: 'POST',
      body: JSON.stringify(body),
    })

  it('returns 400 when required fields are missing', async () => {
    const res = await POST(createRequest({ aluno: 'Aluno' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('Dados incompletos')
  })

  it('returns 400 when sessions have no exercises', async () => {
    const res = await POST(
      createRequest({ aluno: 'Aluno', date: '01/2026', sessions: [{ name: 'A', exercises: [] }] })
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('pelo menos um exercício')
  })

  it('returns PDF when data is valid', async () => {
    generateTrainingPDFMock.mockResolvedValueOnce(Buffer.from('pdf'))

    const res = await POST(
      createRequest({
        aluno: 'José da Silva',
        date: '01/2026',
        sessions: [
          { name: 'A', exercises: [{ name: 'Supino', sets: 3, reps: 10 }] },
        ],
      })
    )

    expect(res.status).toBe(200)
    expect(generateTrainingPDFMock).toHaveBeenCalledWith(
      expect.objectContaining({
        aluno: 'José da Silva',
        date: '01/2026',
        sessions: [
          {
            name: 'A',
            exercises: [{ name: 'Supino', sets: '3', reps: '10' }],
          },
        ],
      })
    )
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toContain('Treino-Jos--da-Silva-01-2026')
  })

  it('returns 500 when PDF generation fails', async () => {
    generateTrainingPDFMock.mockRejectedValueOnce(new Error('Boom'))

    const res = await POST(
      createRequest({
        aluno: 'Aluno',
        date: '01/2026',
        sessions: [
          { name: 'A', exercises: [{ name: 'Supino', sets: 3, reps: 10 }] },
        ],
      })
    )
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toContain('Erro ao gerar PDF')
  })
})
