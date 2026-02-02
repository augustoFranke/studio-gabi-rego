import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/planos/route'

const { prismaMock, withApiAuthMock } = vi.hoisted(() => {
  const { createPrismaMock, createSessionRef, mockWithApiAuth } = globalThis.__testUtils
  const sessionRef = createSessionRef({ user: { role: 'ADMIN' } })
  return {
    prismaMock: createPrismaMock({
      plano: ['findMany', 'create'],
    }),
    withApiAuthMock: mockWithApiAuth(sessionRef).withApiAuth,
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/api', () => ({
  withApiAuth: withApiAuthMock,
}))

describe('Planos API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET lists only active plans by default', async () => {
    prismaMock.plano.findMany.mockResolvedValueOnce([])

    const req = new NextRequest('http://localhost:3000/api/planos')
    await GET(req)

    expect(prismaMock.plano.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ativo: true },
        orderBy: { valor: 'asc' },
      })
    )
  })

  it('GET includes inactive plans when requested', async () => {
    prismaMock.plano.findMany.mockResolvedValueOnce([])

    const req = new NextRequest('http://localhost:3000/api/planos?includeInactive=true')
    await GET(req)

    expect(prismaMock.plano.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      })
    )
  })

  it('POST returns 400 for missing fields', async () => {
    const req = new NextRequest('http://localhost:3000/api/planos', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Plano' }),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('Campos obrigatórios')
  })

  it('POST creates a plan', async () => {
    prismaMock.plano.create.mockResolvedValueOnce({ id: 'p-1' })

    const req = new NextRequest('http://localhost:3000/api/planos', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Plano',
        valor: 100,
        duracaoDias: 30,
        aulasSemanais: 3,
      }),
    })

    const res = await POST(req)

    expect(res.status).toBe(201)
    expect(prismaMock.plano.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nome: 'Plano', valor: 100 }),
      })
    )
  })
})
