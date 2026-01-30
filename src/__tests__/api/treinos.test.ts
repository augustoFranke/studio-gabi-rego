import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { GET, POST } from '@/app/api/treinos/route'
import type { MockValidationOptions, MockValidationSchema } from '@/__tests__/test-utils'

const { prismaMock, sessionRef, withApiAuthMock, validateRequestMock } = vi.hoisted(() => {
  const sessionRef = {
    current: { user: { role: 'ADMIN' as const, membroId: 'm-admin' } },
  } as { current: { user: { role: 'ADMIN' | 'MEMBRO'; membroId?: string } } }

  return {
    prismaMock: {
      fichaTreino: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
        create: vi.fn(),
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

describe('Treinos API - /api/treinos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionRef.current = { user: { role: 'ADMIN', membroId: 'm-admin' } }
  })

  it('GET scopes to session membroId for MEMBRO and keeps active-only default', async () => {
    sessionRef.current = { user: { role: 'MEMBRO', membroId: 'm-1' } }
    prismaMock.fichaTreino.findMany.mockResolvedValue([])

    const req = new NextRequest(
      'http://localhost:3000/api/treinos?membroId=m-2'
    )
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(prismaMock.fichaTreino.findMany).toHaveBeenCalled()
    const callArg = prismaMock.fichaTreino.findMany.mock.calls[0][0]
    expect(callArg.where).toMatchObject({ membroId: 'm-1', ativo: true })
  })

  it('GET allows disabling active-only filter via ativos=false', async () => {
    prismaMock.fichaTreino.findMany.mockResolvedValue([])

    const req = new NextRequest('http://localhost:3000/api/treinos?ativos=false')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const callArg = prismaMock.fichaTreino.findMany.mock.calls[0][0]
    expect(callArg.where).not.toHaveProperty('ativo')
  })

  it('POST returns 403 when session is not ADMIN', async () => {
    sessionRef.current = { user: { role: 'MEMBRO', membroId: 'm-1' } }

    const res = await POST(
      new NextRequest('http://localhost:3000/api/treinos', {
        method: 'POST',
        body: JSON.stringify({ membroId: 'm-1' }),
      })
    )

    expect(res.status).toBe(403)
  })

  it('POST deactivates previous plans and creates mapped exercises', async () => {
    prismaMock.fichaTreino.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.fichaTreino.create.mockResolvedValue({ id: 'f-1' })

    const res = await POST(
      new NextRequest('http://localhost:3000/api/treinos', {
        method: 'POST',
        body: JSON.stringify({
          membroId: 'm-1',
          nome: 'Treino A',
          exercicios: [
            { sessao: 'B', nome: 'Agachamento', series: 4, repeticoes: '12' },
            { nome: undefined },
          ],
        }),
      })
    )

    expect(res.status).toBe(201)
    expect(prismaMock.fichaTreino.updateMany).toHaveBeenCalledWith({
      where: { membroId: 'm-1', ativo: true },
      data: { ativo: false },
    })

    const createArg = prismaMock.fichaTreino.create.mock.calls[0][0]
    expect(createArg.data.membroId).toBe('m-1')
    expect(createArg.data.nome).toBe('Treino A')

    const exerciciosCreate = createArg.data.exercicios?.create
    expect(exerciciosCreate).toHaveLength(2)
    expect(exerciciosCreate?.[0]).toMatchObject({
      sessao: 'B',
      nome: 'Agachamento',
      series: '4',
      repeticoes: '12',
      ordem: 0,
    })
    expect(exerciciosCreate?.[1]).toMatchObject({
      sessao: 'A',
      nome: 'Exercício',
      series: '3',
      repeticoes: '10',
      ordem: 1,
    })
  })
})
