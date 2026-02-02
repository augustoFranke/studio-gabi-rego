import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { GET } from '@/app/api/treinos/[id]/pdf/route'

const { sessionRef, prismaMock, generateTrainingPDFMock, withApiAuthMock } = vi.hoisted(() => {
  const { createPrismaMock, createSessionRef, mockWithApiAuth } = globalThis.__testUtils
  const sessionRef = createSessionRef({ user: { role: 'ADMIN', membroId: 'm-1' } })
  return {
    sessionRef,
    prismaMock: createPrismaMock({
      fichaTreino: ['findUnique'],
    }),
    generateTrainingPDFMock: vi.fn(),
    withApiAuthMock: mockWithApiAuth(sessionRef).withApiAuth,
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/pdf', () => ({
  generateTrainingPDF: generateTrainingPDFMock,
}))

vi.mock('@/lib/api', () => ({
  withApiAuth: withApiAuthMock,
  ensureOwnerOrAdmin: vi.fn(
    (
      session: typeof sessionRef.current,
      ownerId?: string | null,
      options?: { status?: number; error?: string }
    ) => {
      if (session.user.role === 'MEMBRO' && ownerId !== session.user.membroId) {
        return NextResponse.json(
          { error: options?.error ?? 'Não autorizado' },
          { status: options?.status ?? 403 }
        )
      }
      return null
    }
  ),
}))

describe('Treinos PDF by ID API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionRef.current = { user: { role: 'ADMIN', membroId: 'm-1' } }
  })

  const params = (id: string) => ({ params: Promise.resolve({ id }) })

  it('returns 404 when ficha is not found', async () => {
    prismaMock.fichaTreino.findUnique.mockResolvedValueOnce(null)

    const res = await GET(new NextRequest('http://localhost:3000/api/treinos/f-1/pdf'), params('f-1'))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toContain('Ficha não encontrada')
  })

  it('returns 403 when membro tries to access other ficha', async () => {
    sessionRef.current = { user: { role: 'MEMBRO', membroId: 'm-2' } }
    prismaMock.fichaTreino.findUnique.mockResolvedValueOnce({
      id: 'f-1',
      membroId: 'm-1',
      membro: { usuario: { nome: 'Aluno' } },
      exercicios: [],
      observacoes: null,
      data: null,
    })

    const res = await GET(new NextRequest('http://localhost:3000/api/treinos/f-1/pdf'), params('f-1'))
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toContain('Não autorizado')
  })

  it('returns PDF when data is valid', async () => {
    prismaMock.fichaTreino.findUnique.mockResolvedValueOnce({
      id: 'f-1',
      membroId: 'm-1',
      membro: { usuario: { nome: 'Aluno' } },
      exercicios: [
        { sessao: 'B', nome: 'Remada', series: '3', repeticoes: '12' },
        { sessao: 'A', nome: 'Supino', series: '4', repeticoes: '10' },
      ],
      observacoes: 'Obs',
      data: '01/2026',
    })
    generateTrainingPDFMock.mockResolvedValueOnce(Buffer.from('pdf'))

    const res = await GET(new NextRequest('http://localhost:3000/api/treinos/f-1/pdf'), params('f-1'))

    expect(res.status).toBe(200)
    expect(generateTrainingPDFMock).toHaveBeenCalledWith(
      expect.objectContaining({
        aluno: 'Aluno',
        date: '01/2026',
        sessions: [
          {
            name: 'A',
            exercises: [{ name: 'Supino', sets: '4', reps: '10' }],
          },
          {
            name: 'B',
            exercises: [{ name: 'Remada', sets: '3', reps: '12' }],
          },
        ],
      })
    )
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
  })

  it('returns 500 when PDF generation fails', async () => {
    prismaMock.fichaTreino.findUnique.mockResolvedValueOnce({
      id: 'f-1',
      membroId: 'm-1',
      membro: { usuario: { nome: 'Aluno' } },
      exercicios: [],
      observacoes: null,
      data: null,
    })
    generateTrainingPDFMock.mockRejectedValueOnce(new Error('Boom'))

    const res = await GET(new NextRequest('http://localhost:3000/api/treinos/f-1/pdf'), params('f-1'))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toContain('Erro ao gerar PDF')
  })
})
