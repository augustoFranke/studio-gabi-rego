import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { POST } from '@/app/api/horarios/get-or-create/route'
import { MAX_CAPACITY_PER_SLOT } from '@/lib/schedule'
import type { MockValidationOptions, MockValidationSchema } from '@/__tests__/test-utils'

const { prismaMock, sessionRef, withApiAuthMock, validateRequestMock } = vi.hoisted(() => {
  const sessionRef = {
    current: { user: { role: 'ADMIN' as const } },
  } as { current: { user: { role: 'ADMIN' | 'MEMBRO' } } }

  return {
    prismaMock: {
      horarioDisponivel: {
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

describe('Horarios API - POST /api/horarios/get-or-create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionRef.current = { user: { role: 'ADMIN' } }
  })

  const createRequest = (body: Record<string, unknown>) =>
    new NextRequest('http://localhost:3000/api/horarios/get-or-create', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })

  it('returns 400 when required fields are missing', async () => {
    const res = await POST(createRequest({ diaSemana: 'SEGUNDA' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('Campos obrigatorios')
  })

  it('returns an existing active horario when found', async () => {
    prismaMock.horarioDisponivel.findFirst.mockResolvedValue({
      id: 'h-1',
      diaSemana: 'SEGUNDA',
      horaInicio: '09:00',
      horaFim: '10:00',
      vagasTotal: 8,
      ativo: true,
    })

    const res = await POST(createRequest({ diaSemana: 'SEGUNDA', horaInicio: '9:00' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.horarioDisponivel.create).not.toHaveBeenCalled()
    expect(json.id).toBe('h-1')
  })

  it('creates a new horario with normalized hours and default capacity', async () => {
    prismaMock.horarioDisponivel.findFirst.mockResolvedValue(null)
    prismaMock.horarioDisponivel.create.mockResolvedValue({
      id: 'h-new',
      diaSemana: 'SEGUNDA',
      horaInicio: '09:00',
      horaFim: '10:00',
      vagasTotal: MAX_CAPACITY_PER_SLOT,
      ativo: true,
    })

    const res = await POST(createRequest({ diaSemana: 'SEGUNDA', horaInicio: '9:15' }))

    expect(res.status).toBe(200)
    expect(prismaMock.horarioDisponivel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          diaSemana: 'SEGUNDA',
          horaInicio: '09:00',
          horaFim: '10:00',
          vagasTotal: MAX_CAPACITY_PER_SLOT,
        }),
      })
    )
  })

  it('returns 403 when session role is not ADMIN', async () => {
    sessionRef.current = { user: { role: 'MEMBRO' } }

    const res = await POST(createRequest({ diaSemana: 'SEGUNDA', horaInicio: '09:00' }))

    expect(res.status).toBe(403)
  })
})
