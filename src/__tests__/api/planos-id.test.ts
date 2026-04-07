import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { DELETE, GET, PUT } from '@/app/api/planos/[id]/route'

const { prismaMock, sessionRef, withApiAuthMock, validateRequestMock } = vi.hoisted(() => {
  const {
    createPrismaMock,
    createSessionRef,
    createValidateRequestMock,
    mockWithApiAuth,
  } = globalThis.__testUtils
  const sessionRef = createSessionRef({ user: { role: 'ADMIN' } })
  return {
    prismaMock: createPrismaMock({
      plano: ['findUnique', 'update', 'delete'],
      membro: ['count'],
    }),
    sessionRef,
    withApiAuthMock: mockWithApiAuth(sessionRef).withApiAuth,
    validateRequestMock: createValidateRequestMock(),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/api', () => ({
  withApiAuth: withApiAuthMock,
  validateRequest: validateRequestMock,
}))

describe('Planos API - /api/planos/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionRef.current = { user: { role: 'ADMIN' } }
  })

  const params = (id: string) => ({ params: Promise.resolve({ id }) })

  it('GET returns 404 when plan not found', async () => {
    prismaMock.plano.findUnique.mockResolvedValueOnce(null)

    const res = await GET(new NextRequest('http://localhost:3000/api/planos/p-1'), params('p-1'))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toContain('Plano não encontrado')
  })

  it('GET returns plan when found', async () => {
    prismaMock.plano.findUnique.mockResolvedValueOnce({ id: 'p-1' })

    const res = await GET(new NextRequest('http://localhost:3000/api/planos/p-1'), params('p-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.id).toBe('p-1')
    expect(prismaMock.plano.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          _count: {
            select: { membros: true, pagamentos: true },
          },
        },
      })
    )
  })

  it('GET hides counts for non-admins', async () => {
    sessionRef.current = { user: { role: 'MEMBRO' } }
    prismaMock.plano.findUnique.mockResolvedValueOnce({ id: 'p-1' })

    const res = await GET(new NextRequest('http://localhost:3000/api/planos/p-1'), params('p-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.id).toBe('p-1')
    const args = prismaMock.plano.findUnique.mock.calls[0]?.[0]
    expect(args.include).toBeUndefined()
  })

  it('PUT updates plan fields', async () => {
    prismaMock.plano.findUnique.mockResolvedValueOnce({ id: 'p-1' })
    prismaMock.plano.update.mockResolvedValueOnce({ id: 'p-1' })

    const req = new NextRequest('http://localhost:3000/api/planos/p-1', {
      method: 'PUT',
      body: JSON.stringify({ nome: 'Novo', ativo: false }),
    })

    const res = await PUT(req, params('p-1'))

    expect(res.status).toBe(200)
    expect(prismaMock.plano.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p-1' },
        data: expect.objectContaining({ nome: 'Novo', ativo: false }),
      })
    )
  })

  it('DELETE deactivates when active members exist', async () => {
    prismaMock.plano.findUnique.mockResolvedValueOnce({ id: 'p-1' })
    prismaMock.membro.count.mockResolvedValueOnce(2)
    prismaMock.plano.update.mockResolvedValueOnce({ id: 'p-1', ativo: false })

    const res = await DELETE(new NextRequest('http://localhost:3000/api/planos/p-1'), params('p-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.plano.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { ativo: false } })
    )
    expect(json.message).toContain('Plano desativado')
  })

  it('DELETE removes plan when no active members exist', async () => {
    prismaMock.plano.findUnique.mockResolvedValueOnce({ id: 'p-1' })
    prismaMock.membro.count.mockResolvedValueOnce(0)
    prismaMock.plano.delete.mockResolvedValueOnce({ id: 'p-1' })

    const res = await DELETE(new NextRequest('http://localhost:3000/api/planos/p-1'), params('p-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.plano.delete).toHaveBeenCalledWith({ where: { id: 'p-1' } })
    expect(json.message).toContain('Plano removido')
  })
})
