import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { POST } from '@/app/api/treinos/gerar-pdf/route'

const { sessionRef, generateTrainingPDFMock } = vi.hoisted(() => ({
  sessionRef: {
    current: { user: { role: 'ADMIN' as const } },
  } as { current: { user: { role: 'ADMIN' | 'MEMBRO' } } },
  generateTrainingPDFMock: vi.fn(),
}))

vi.mock('@/lib/pdf', () => ({
  generateTrainingPDF: generateTrainingPDFMock,
}))

vi.mock('@/lib/api', () => ({
  withApiAuth: vi.fn(
    async (
      handler: (session: typeof sessionRef.current) => Promise<NextResponse>,
      options?: { requiredRole?: 'ADMIN' | 'MEMBRO'; requireAuth?: boolean }
    ) => {
      if (options?.requiredRole && sessionRef.current.user.role !== options.requiredRole) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
      }
      return handler(sessionRef.current)
    }
  ),
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
