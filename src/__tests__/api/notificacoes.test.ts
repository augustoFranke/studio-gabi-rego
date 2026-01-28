import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { GET, POST } from '@/app/api/notificacoes/route'

const { sessionRef, prismaMock } = vi.hoisted(() => ({
  sessionRef: {
    current: { user: { role: 'ADMIN' as const, membroId: 'm-1' } },
  } as { current: { user: { role: 'ADMIN' | 'MEMBRO'; membroId?: string } } },
  prismaMock: {
    notificacao: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
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

describe('Notificacoes API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionRef.current = { user: { role: 'ADMIN', membroId: 'm-1' } }
  })

  it('GET scopes to session membroId for members', async () => {
    sessionRef.current = { user: { role: 'MEMBRO', membroId: 'm-session' } }
    prismaMock.notificacao.findMany.mockResolvedValueOnce([])

    const req = new NextRequest('http://localhost:3000/api/notificacoes?membroId=m-other')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(prismaMock.notificacao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ membroId: 'm-session' }),
      })
    )
  })

  it('GET applies enviada filter when provided', async () => {
    prismaMock.notificacao.findMany.mockResolvedValueOnce([])

    const req = new NextRequest('http://localhost:3000/api/notificacoes?enviada=true')
    await GET(req)

    expect(prismaMock.notificacao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ enviada: true }),
      })
    )
  })

  it('POST returns 400 for missing fields', async () => {
    const req = new NextRequest('http://localhost:3000/api/notificacoes', {
      method: 'POST',
      body: JSON.stringify({ titulo: 'Oi' }),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('Campos obrigatórios')
  })

  it('POST creates notification', async () => {
    prismaMock.notificacao.create.mockResolvedValueOnce({ id: 'n-1' })

    const req = new NextRequest('http://localhost:3000/api/notificacoes', {
      method: 'POST',
      body: JSON.stringify({
        membroId: 'm-1',
        tipo: 'INFO',
        titulo: 'Oi',
        mensagem: 'Mensagem',
        canalWhatsapp: true,
      }),
    })

    const res = await POST(req)

    expect(res.status).toBe(201)
    expect(prismaMock.notificacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          membroId: 'm-1',
          tipo: 'INFO',
          titulo: 'Oi',
          mensagem: 'Mensagem',
          canalWhatsapp: true,
        }),
      })
    )
  })

  it('POST returns 500 on error', async () => {
    prismaMock.notificacao.create.mockRejectedValueOnce(new Error('DB error'))

    const req = new NextRequest('http://localhost:3000/api/notificacoes', {
      method: 'POST',
      body: JSON.stringify({
        tipo: 'INFO',
        titulo: 'Oi',
        mensagem: 'Mensagem',
      }),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toContain('Erro interno')
  })
})
