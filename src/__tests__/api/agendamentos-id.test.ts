import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { DELETE, GET, PATCH } from '@/app/api/agendamentos/[id]/route'
import type { MockValidationOptions, MockValidationSchema } from '@/__tests__/test-utils'

const { prismaMock, sessionRef, withApiAuthMock, validateRequestMock, ensureOwnerOrAdminMock } = vi.hoisted(() => {
  const sessionRef = {
    current: { user: { role: 'ADMIN' as const, membroId: 'm-admin' } },
  } as { current: { user: { role: 'ADMIN' | 'MEMBRO'; membroId?: string } } }

  return {
    prismaMock: {
      agendamento: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      horarioDisponivel: {
        findUnique: vi.fn(),
      },
    },
    sessionRef,
    withApiAuthMock: vi.fn(
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
    validateRequestMock: vi.fn(async (request: NextRequest, schema: MockValidationSchema, options?: MockValidationOptions) => {
      let body: unknown
      try {
        body = await request.json()
      } catch {
        return {
          error: NextResponse.json(
            { error: options?.invalidJsonMessage ?? 'Dados inválidos enviados. Verifique o formulário.' },
            { status: 400 }
          ),
        }
      }

      const validation = schema.safeParse(body)
      if (!validation.success) {
        const message =
          options?.errorMessage?.(validation.error) ??
          validation.error.issues[0]?.message ??
          'Dados inválidos enviados. Verifique o formulário.'
        return { error: NextResponse.json({ error: message }, { status: 400 }) }
      }

      return { data: validation.data }
    }),
    ensureOwnerOrAdminMock: vi.fn(
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
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/api', () => ({
  withApiAuth: withApiAuthMock,
  validateRequest: validateRequestMock,
  ensureOwnerOrAdmin: ensureOwnerOrAdminMock,
}))

describe('Agendamentos API - /api/agendamentos/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionRef.current = { user: { role: 'ADMIN', membroId: 'm-admin' } }
  })

  const params = (id: string) => ({ params: Promise.resolve({ id }) })

  it('GET returns 404 when not found', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValue(null)

    const res = await GET(new NextRequest('http://localhost:3000/api/agendamentos/a-1'), params('a-1'))

    expect(res.status).toBe(404)
  })

  it('GET returns 403 when membro tries to access another member booking', async () => {
    sessionRef.current = { user: { role: 'MEMBRO', membroId: 'm-1' } }
    prismaMock.agendamento.findUnique.mockResolvedValue({
      id: 'a-1',
      membroId: 'm-2',
    })

    const res = await GET(new NextRequest('http://localhost:3000/api/agendamentos/a-1'), params('a-1'))

    expect(res.status).toBe(403)
  })

  it('GET returns booking when authorized', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValue({
      id: 'a-1',
      membroId: 'm-admin',
    })

    const res = await GET(new NextRequest('http://localhost:3000/api/agendamentos/a-1'), params('a-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.id).toBe('a-1')
  })

  it('PATCH returns 403 when session is not ADMIN', async () => {
    sessionRef.current = { user: { role: 'MEMBRO', membroId: 'm-1' } }

    const res = await PATCH(
      new NextRequest('http://localhost:3000/api/agendamentos/a-1', {
        method: 'PATCH',
        body: JSON.stringify({ observacao: 'nota' }),
      }),
      params('a-1')
    )

    expect(res.status).toBe(403)
  })

  it('PATCH returns 404 when booking does not exist', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValue(null)

    const res = await PATCH(
      new NextRequest('http://localhost:3000/api/agendamentos/a-1', {
        method: 'PATCH',
        body: JSON.stringify({ observacao: 'nota' }),
      }),
      params('a-1')
    )

    expect(res.status).toBe(404)
  })

  it('PATCH returns 400 when duplicate booking exists on move', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValue({
      id: 'a-1',
      membroId: 'm-1',
      horarioId: 'h-1',
      data: new Date('2025-01-20T12:00:00'),
    })
    prismaMock.agendamento.findFirst.mockResolvedValue({ id: 'a-dup' })

    const res = await PATCH(
      new NextRequest('http://localhost:3000/api/agendamentos/a-1', {
        method: 'PATCH',
        body: JSON.stringify({ horarioId: 'h-2', data: '2025-01-21' }),
      }),
      params('a-1')
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('Ja existe agendamento')
  })

  it('PATCH returns 400 when target horario is inactive', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValue({
      id: 'a-1',
      membroId: 'm-1',
      horarioId: 'h-1',
      data: new Date('2025-01-20T12:00:00'),
    })
    prismaMock.agendamento.findFirst.mockResolvedValue(null)
    prismaMock.horarioDisponivel.findUnique.mockResolvedValue({
      id: 'h-2',
      ativo: false,
      vagasTotal: 10,
    })

    const res = await PATCH(
      new NextRequest('http://localhost:3000/api/agendamentos/a-1', {
        method: 'PATCH',
        body: JSON.stringify({ horarioId: 'h-2', data: '2025-01-21' }),
      }),
      params('a-1')
    )

    expect(res.status).toBe(400)
  })

  it('PATCH returns 400 when capacity is full', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValue({
      id: 'a-1',
      membroId: 'm-1',
      horarioId: 'h-1',
      data: new Date('2025-01-20T12:00:00'),
    })
    prismaMock.agendamento.findFirst.mockResolvedValue(null)
    prismaMock.horarioDisponivel.findUnique.mockResolvedValue({
      id: 'h-2',
      ativo: true,
      vagasTotal: 1,
    })
    prismaMock.agendamento.count.mockResolvedValue(1)

    const res = await PATCH(
      new NextRequest('http://localhost:3000/api/agendamentos/a-1', {
        method: 'PATCH',
        body: JSON.stringify({ horarioId: 'h-2', data: '2025-01-21' }),
      }),
      params('a-1')
    )

    expect(res.status).toBe(400)
  })

  it('PATCH updates simple fields without move checks', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValue({
      id: 'a-1',
      membroId: 'm-1',
      horarioId: 'h-1',
      data: new Date('2025-01-20T12:00:00'),
    })
    prismaMock.agendamento.update.mockResolvedValue({ id: 'a-1', observacao: 'ok' })

    const res = await PATCH(
      new NextRequest('http://localhost:3000/api/agendamentos/a-1', {
        method: 'PATCH',
        body: JSON.stringify({ observacao: 'ok' }),
      }),
      params('a-1')
    )

    expect(res.status).toBe(200)
    expect(prismaMock.agendamento.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.horarioDisponivel.findUnique).not.toHaveBeenCalled()
  })

  it('DELETE returns 404 when booking does not exist', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValue(null)

    const res = await DELETE(new NextRequest('http://localhost:3000/api/agendamentos/a-1'), params('a-1'))

    expect(res.status).toBe(404)
  })

  it('DELETE removes booking when it exists', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValue({ id: 'a-1' })

    const res = await DELETE(new NextRequest('http://localhost:3000/api/agendamentos/a-1'), params('a-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.agendamento.delete).toHaveBeenCalledWith({ where: { id: 'a-1' } })
    expect(json.success).toBe(true)
  })
})
