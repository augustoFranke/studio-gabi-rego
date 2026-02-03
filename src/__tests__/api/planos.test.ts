import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { GET, POST } from '@/app/api/planos/route'

const { prismaMock, sessionRef } = vi.hoisted(() => ({
  prismaMock: {
    plano: {
      findMany: vi.fn(),
      create: vi.fn(),
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

describe('Planos API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionRef.current = { user: { role: 'ADMIN' } }
  })

  it('GET lists only active plans by default', async () => {
    prismaMock.plano.findMany.mockResolvedValueOnce([])

    const req = new NextRequest('http://localhost:3000/api/planos')
    await GET(req)

    const args = prismaMock.plano.findMany.mock.calls[0]?.[0]
    expect(args).toEqual(expect.objectContaining({
      where: { ativo: true },
      orderBy: { valor: 'asc' },
    }))
    expect(args.include).toEqual({
      _count: {
        select: { membros: true, pagamentos: true },
      },
    })
  })

  it('GET includes inactive plans when requested', async () => {
    prismaMock.plano.findMany.mockResolvedValueOnce([])

    const req = new NextRequest('http://localhost:3000/api/planos?includeInactive=true')
    await GET(req)

    const args = prismaMock.plano.findMany.mock.calls[0]?.[0]
    expect(args).toEqual(expect.objectContaining({
      where: {},
    }))
    expect(args.include).toEqual({
      _count: {
        select: { membros: true, pagamentos: true },
      },
    })
  })

  it('GET ignores inactive flag for non-admins and hides counts', async () => {
    sessionRef.current = { user: { role: 'MEMBRO' } }
    prismaMock.plano.findMany.mockResolvedValueOnce([])

    const req = new NextRequest('http://localhost:3000/api/planos?includeInactive=true')
    await GET(req)

    const args = prismaMock.plano.findMany.mock.calls[0]?.[0]
    expect(args).toEqual(expect.objectContaining({
      where: { ativo: true },
      orderBy: { valor: 'asc' },
    }))
    expect(args.include).toBeUndefined()
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
