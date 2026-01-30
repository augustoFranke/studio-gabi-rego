import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { DELETE, GET, PUT } from '@/app/api/treinos/[id]/route'
import type { MockValidationOptions, MockValidationSchema } from '@/__tests__/test-utils'

const { prismaMock, sessionRef, withApiAuthMock, validateRequestMock } = vi.hoisted(() => {
  const sessionRef = {
    current: { user: { role: 'ADMIN' as const, membroId: 'm-admin' } },
  } as { current: { user: { role: 'ADMIN' | 'MEMBRO'; membroId?: string } } }

  return {
    prismaMock: {
      fichaTreino: {
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      exercicio: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
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
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/api', () => ({
  withApiAuth: withApiAuthMock,
  validateRequest: validateRequestMock,
}))

describe('Treinos API - /api/treinos/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionRef.current = { user: { role: 'ADMIN', membroId: 'm-admin' } }
  })

  const params = (id: string) => ({ params: Promise.resolve({ id }) })

  it('GET returns 404 when plan is missing', async () => {
    prismaMock.fichaTreino.findUnique.mockResolvedValue(null)

    const res = await GET(new NextRequest('http://localhost:3000/api/treinos/f-1'), params('f-1'))

    expect(res.status).toBe(404)
  })

  it('GET returns 401 when member accesses another member plan', async () => {
    sessionRef.current = { user: { role: 'MEMBRO', membroId: 'm-1' } }
    prismaMock.fichaTreino.findUnique.mockResolvedValue({ id: 'f-1', membroId: 'm-2' })

    const res = await GET(new NextRequest('http://localhost:3000/api/treinos/f-1'), params('f-1'))

    expect(res.status).toBe(401)
  })

  it('GET returns plan when authorized', async () => {
    prismaMock.fichaTreino.findUnique.mockResolvedValue({ id: 'f-1', membroId: 'm-admin' })

    const res = await GET(new NextRequest('http://localhost:3000/api/treinos/f-1'), params('f-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.id).toBe('f-1')
  })

  it('PUT returns 403 when session is not ADMIN', async () => {
    sessionRef.current = { user: { role: 'MEMBRO', membroId: 'm-1' } }

    const res = await PUT(
      new NextRequest('http://localhost:3000/api/treinos/f-1', {
        method: 'PUT',
        body: JSON.stringify({ nome: 'Novo' }),
      }),
      params('f-1')
    )

    expect(res.status).toBe(403)
  })

  it('PUT returns 404 when plan does not exist', async () => {
    prismaMock.fichaTreino.findUnique.mockResolvedValue(null)

    const res = await PUT(
      new NextRequest('http://localhost:3000/api/treinos/f-1', {
        method: 'PUT',
        body: JSON.stringify({ nome: 'Novo' }),
      }),
      params('f-1')
    )

    expect(res.status).toBe(404)
  })

  it('PUT replaces exercises when provided and maps values', async () => {
    prismaMock.fichaTreino.findUnique.mockResolvedValue({ id: 'f-1' })
    prismaMock.fichaTreino.update.mockResolvedValue({ id: 'f-1' })

    const res = await PUT(
      new NextRequest('http://localhost:3000/api/treinos/f-1', {
        method: 'PUT',
        body: JSON.stringify({
          exercicios: [
            { sessao: 'C', nome: 'Supino', series: 5 },
            {},
          ],
        }),
      }),
      params('f-1')
    )

    expect(res.status).toBe(200)
    expect(prismaMock.exercicio.deleteMany).toHaveBeenCalledWith({ where: { fichaId: 'f-1' } })

    const createManyArg = prismaMock.exercicio.createMany.mock.calls[0][0]
    expect(createManyArg.data).toHaveLength(2)
    expect(createManyArg.data[0]).toMatchObject({
      fichaId: 'f-1',
      sessao: 'C',
      nome: 'Supino',
      series: '5',
      repeticoes: '10',
      ordem: 0,
    })
    expect(createManyArg.data[1]).toMatchObject({
      fichaId: 'f-1',
      sessao: 'A',
      nome: 'Exercício',
      series: '3',
      repeticoes: '10',
      ordem: 1,
    })
  })

  it('PUT updates fields without touching exercises when not provided', async () => {
    prismaMock.fichaTreino.findUnique.mockResolvedValue({ id: 'f-1' })
    prismaMock.fichaTreino.update.mockResolvedValue({ id: 'f-1', nome: 'Atualizado' })

    const res = await PUT(
      new NextRequest('http://localhost:3000/api/treinos/f-1', {
        method: 'PUT',
        body: JSON.stringify({ nome: 'Atualizado' }),
      }),
      params('f-1')
    )

    expect(res.status).toBe(200)
    expect(prismaMock.exercicio.deleteMany).not.toHaveBeenCalled()
    expect(prismaMock.exercicio.createMany).not.toHaveBeenCalled()

    const updateArg = prismaMock.fichaTreino.update.mock.calls[0][0]
    expect(updateArg.data).toMatchObject({ nome: 'Atualizado' })
  })

  it('DELETE returns 404 when plan does not exist', async () => {
    prismaMock.fichaTreino.findUnique.mockResolvedValue(null)

    const res = await DELETE(new NextRequest('http://localhost:3000/api/treinos/f-1'), params('f-1'))

    expect(res.status).toBe(404)
  })

  it('DELETE removes plan when it exists', async () => {
    prismaMock.fichaTreino.findUnique.mockResolvedValue({ id: 'f-1' })

    const res = await DELETE(new NextRequest('http://localhost:3000/api/treinos/f-1'), params('f-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.fichaTreino.delete).toHaveBeenCalledWith({ where: { id: 'f-1' } })
    expect(json.success).toBe(true)
  })
})
