import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { DELETE, GET, PUT } from '@/app/api/planos/[id]/route'

const { prismaMock, sessionRef } = vi.hoisted(() => ({
  prismaMock: {
    plano: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    membro: {
      count: vi.fn(),
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
    prismaMock.membro.count.mockResolvedValueOnce(0)
    prismaMock.plano.delete.mockResolvedValueOnce({ id: 'p-1' })

    const res = await DELETE(new NextRequest('http://localhost:3000/api/planos/p-1'), params('p-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.plano.delete).toHaveBeenCalledWith({ where: { id: 'p-1' } })
    expect(json.message).toContain('Plano removido')
  })
})
