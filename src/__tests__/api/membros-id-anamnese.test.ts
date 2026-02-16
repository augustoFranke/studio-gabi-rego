import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/membros/[id]/anamnese/route'

const { prismaMock, sessionRef, withApiAuthMock } = vi.hoisted(() => {
  const { createPrismaMock, createSessionRef, mockWithApiAuth } = globalThis.__testUtils
  const sessionRef = createSessionRef({ user: { role: 'ADMIN' } })
  return {
    prismaMock: createPrismaMock({
      membro: ['findUnique'],
      anamnese: ['upsert'],
    }),
    sessionRef,
    withApiAuthMock: mockWithApiAuth(sessionRef).withApiAuth,
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/api', () => ({
  withApiAuth: withApiAuthMock,
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

  it('GET returns null when sexo is missing', async () => {
    prismaMock.membro.findUnique.mockResolvedValueOnce({
      id: 'm-1',
      sexo: null,
      usuario: { nome: 'Maria Souza' },
      anamnese: null,
    })

    const res = await GET(new NextRequest('http://localhost:3000/api/membros/m-1/anamnese'), params('m-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.member.sexo).toBeNull()
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

  it('POST rejects unknown fields', async () => {
    prismaMock.membro.findUnique.mockResolvedValueOnce({ id: 'm-1' })

    const req = new NextRequest('http://localhost:3000/api/membros/m-1/anamnese', {
      method: 'POST',
      body: JSON.stringify({ objetivo: 'Saude', role: 'ADMIN' }),
    })
    const res = await POST(req, params('m-1'))

    expect(res.status).toBe(400)
    expect(prismaMock.anamnese.upsert).not.toHaveBeenCalled()
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
