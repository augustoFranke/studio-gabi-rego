import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { GET, POST } from '@/app/api/membros/[id]/anamnese/route'

const { prismaMock, sessionRef } = vi.hoisted(() => ({
  prismaMock: {
    membro: {
      findUnique: vi.fn(),
    },
    anamnese: {
      upsert: vi.fn(),
    },
  },
  sessionRef: {
    current: { user: { role: 'ADMIN' as const } },
  } as { current: { user: { role: 'ADMIN' | 'MEMBRO' } } },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
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

describe('Membros Anamnese API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionRef.current = { user: { role: 'ADMIN' } }
  })

  const params = (id: string) => ({ params: Promise.resolve({ id }) })

  it('GET returns 404 when membro not found', async () => {
    prismaMock.membro.findUnique.mockResolvedValueOnce(null)

    const res = await GET(new NextRequest('http://localhost:3000/api/membros/m-1/anamnese'), params('m-1'))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toContain('Membro não encontrado')
  })

  it('GET uses sexo from database when present', async () => {
    prismaMock.membro.findUnique.mockResolvedValueOnce({
      id: 'm-1',
      sexo: 'FEMININO',
      usuario: { nome: 'Julia' },
      anamnese: { id: 'a-1' },
    })

    const res = await GET(new NextRequest('http://localhost:3000/api/membros/m-1/anamnese'), params('m-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.member.sexo).toBe('Feminino')
  })

  it('GET falls back to name heuristic when sexo is missing', async () => {
    prismaMock.membro.findUnique.mockResolvedValueOnce({
      id: 'm-1',
      sexo: null,
      usuario: { nome: 'Maria Souza' },
      anamnese: null,
    })

    const res = await GET(new NextRequest('http://localhost:3000/api/membros/m-1/anamnese'), params('m-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.member.sexo).toBe('Feminino')
  })

  it('POST returns 404 when membro not found', async () => {
    prismaMock.membro.findUnique.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost:3000/api/membros/m-1/anamnese', {
      method: 'POST',
      body: JSON.stringify({ objetivo: 'Saude' }),
    })
    const res = await POST(req, params('m-1'))

    expect(res.status).toBe(404)
  })

  it('POST upserts anamnese', async () => {
    prismaMock.membro.findUnique.mockResolvedValueOnce({ id: 'm-1' })
    prismaMock.anamnese.upsert.mockResolvedValueOnce({ id: 'a-1' })

    const req = new NextRequest('http://localhost:3000/api/membros/m-1/anamnese', {
      method: 'POST',
      body: JSON.stringify({ objetivo: 'Saude' }),
    })
    const res = await POST(req, params('m-1'))

    expect(res.status).toBe(200)
    expect(prismaMock.anamnese.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { membroId: 'm-1' },
        create: expect.objectContaining({ membroId: 'm-1', objetivo: 'Saude' }),
        update: { objetivo: 'Saude' },
      })
    )
  })
})
