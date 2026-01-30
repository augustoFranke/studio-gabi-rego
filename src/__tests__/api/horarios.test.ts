import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { GET, POST } from '@/app/api/horarios/route'
import type { MockValidationOptions, MockValidationSchema } from '@/__tests__/test-utils'

const { prismaMock, sessionRef, withApiAuthMock, validateRequestMock } = vi.hoisted(() => {
  const sessionRef = {
    current: { user: { role: 'ADMIN' as const } },
  } as { current: { user: { role: 'ADMIN' | 'MEMBRO' } } }

  return {
    prismaMock: {
      horarioDisponivel: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
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

describe('Horarios API - /api/horarios', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionRef.current = { user: { role: 'ADMIN' } }
  })

  it('GET applies diaSemana and ativo filters', async () => {
    prismaMock.horarioDisponivel.findMany.mockResolvedValue([])

    const req = new NextRequest(
      'http://localhost:3000/api/horarios?diaSemana=SEGUNDA&ativo=true'
    )
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(prismaMock.horarioDisponivel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { diaSemana: 'SEGUNDA', ativo: true },
      })
    )
  })

  it('POST returns 403 when session is not ADMIN', async () => {
    sessionRef.current = { user: { role: 'MEMBRO' } }

    const res = await POST(
      new NextRequest('http://localhost:3000/api/horarios', {
        method: 'POST',
        body: JSON.stringify({
          diaSemana: 'SEGUNDA',
          horaInicio: '09:00',
          horaFim: '10:00',
          vagasTotal: 10,
        }),
      })
    )

    expect(res.status).toBe(403)
  })

  it('POST returns 400 when required fields are missing', async () => {
    const res = await POST(
      new NextRequest('http://localhost:3000/api/horarios', {
        method: 'POST',
        body: JSON.stringify({ diaSemana: 'SEGUNDA', horaInicio: '09:00' }),
      })
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('Campos obrigatorios')
  })

  it('POST returns 400 when horario already exists', async () => {
    prismaMock.horarioDisponivel.findFirst.mockResolvedValue({ id: 'h-1' })

    const res = await POST(
      new NextRequest('http://localhost:3000/api/horarios', {
        method: 'POST',
        body: JSON.stringify({
          diaSemana: 'SEGUNDA',
          horaInicio: '09:00',
          horaFim: '10:00',
          vagasTotal: 10,
        }),
      })
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('Ja existe um horario')
  })

  it('POST creates a new horario when valid and unique', async () => {
    prismaMock.horarioDisponivel.findFirst.mockResolvedValue(null)
    prismaMock.horarioDisponivel.create.mockResolvedValue({ id: 'h-new' })

    const res = await POST(
      new NextRequest('http://localhost:3000/api/horarios', {
        method: 'POST',
        body: JSON.stringify({
          diaSemana: 'SEGUNDA',
          horaInicio: '09:00',
          horaFim: '10:00',
          vagasTotal: 10,
        }),
      })
    )
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(prismaMock.horarioDisponivel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          diaSemana: 'SEGUNDA',
          horaInicio: '09:00',
          horaFim: '10:00',
          vagasTotal: 10,
        }),
      })
    )
    expect(json.id).toBe('h-new')
  })
})
