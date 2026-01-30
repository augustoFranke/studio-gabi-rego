import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { GET, POST } from '@/app/api/agendamentos/route'
import { createJsonRequest } from '@/__tests__/test-utils'
import type { MockValidationOptions, MockValidationSchema } from '@/__tests__/test-utils'

const { prismaMock, sessionRef, withApiAuthMock, validateRequestMock } = vi.hoisted(() => {
  const sessionRef = {
    current: { user: { role: 'ADMIN' as const, membroId: 'm-admin' } },
  } as { current: { user: { role: 'ADMIN' | 'MEMBRO'; membroId?: string } } }

  return {
    prismaMock: {
      agendamento: {
        findMany: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      membro: {
        findUnique: vi.fn(),
      },
      horarioDisponivel: {
        findUnique: vi.fn(),
      },
      horarioFixo: {
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

describe('Agendamentos API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionRef.current = { user: { role: 'ADMIN', membroId: 'm-admin' } }
  })

  const createRequest = (body: Record<string, unknown>) =>
    createJsonRequest('http://localhost:3000/api/agendamentos', body)

  it('GET scopes to membroId when session is MEMBRO', async () => {
    sessionRef.current = { user: { role: 'MEMBRO', membroId: 'm-1' } }
    prismaMock.agendamento.findMany.mockResolvedValue([])

    const req = new NextRequest(
      'http://localhost:3000/api/agendamentos?membroId=m-2'
    )
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(prismaMock.agendamento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ membroId: 'm-1' }),
      })
    )
  })

  it('POST returns 400 when membroId is missing for admin', async () => {
    const res = await POST(createRequest({ horarioId: 'h-1', data: '2025-01-20' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('Membro ID não identificado')
  })

  it('POST uses session membroId when role is MEMBRO', async () => {
    sessionRef.current = { user: { role: 'MEMBRO', membroId: 'm-session' } }
    prismaMock.horarioDisponivel.findUnique.mockResolvedValue({
      id: 'h-1',
      ativo: true,
      vagasTotal: 10,
    })
    prismaMock.agendamento.count.mockResolvedValue(0)
    prismaMock.agendamento.findFirst.mockResolvedValue(null)
    prismaMock.agendamento.create.mockResolvedValue({
      id: 'a-1',
      membroId: 'm-session',
      horarioId: 'h-1',
      data: new Date('2025-01-20T12:00:00'),
      presente: null,
      observacao: null,
      membro: {
        id: 'm-session',
        fotoUrl: null,
        usuario: { nome: 'Aluno', email: 'aluno@example.com' },
      },
      horario: {
        id: 'h-1',
        diaSemana: 'SEGUNDA',
        horaInicio: '10:00',
        horaFim: '11:00',
        vagasTotal: 10,
      },
    })

    const res = await POST(
      createRequest({ membroId: 'm-other', horarioId: 'h-1', data: '2025-01-20' })
    )

    expect(res.status).toBe(201)
    expect(prismaMock.agendamento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ membroId: 'm-session', horarioId: 'h-1' }),
      })
    )
  })

  it('POST returns 400 when horario is not available', async () => {
    prismaMock.horarioDisponivel.findUnique.mockResolvedValue(null)

    const res = await POST(
      createRequest({ membroId: 'm-1', horarioId: 'h-missing', data: '2025-01-20' })
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('Horário não disponível')
  })

  it('POST returns 400 when slot capacity is full', async () => {
    prismaMock.horarioDisponivel.findUnique.mockResolvedValue({
      id: 'h-1',
      ativo: true,
      vagasTotal: 2,
    })
    prismaMock.agendamento.count.mockResolvedValue(2)

    const res = await POST(
      createRequest({ membroId: 'm-1', horarioId: 'h-1', data: '2025-01-20' })
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('Não há vagas disponíveis')
  })

  it('POST returns 400 when member already has a booking', async () => {
    prismaMock.horarioDisponivel.findUnique.mockResolvedValue({
      id: 'h-1',
      ativo: true,
      vagasTotal: 10,
    })
    prismaMock.agendamento.count.mockResolvedValue(1)
    prismaMock.agendamento.findFirst.mockResolvedValue({ id: 'a-existing' })

    const res = await POST(
      createRequest({ membroId: 'm-1', horarioId: 'h-1', data: '2025-01-20' })
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('já tem um agendamento')
  })

  it('POST returns 400 when weekly limit is exceeded', async () => {
    prismaMock.horarioDisponivel.findUnique.mockResolvedValue({
      id: 'h-1',
      ativo: true,
      vagasTotal: 10,
      diaSemana: 'SEGUNDA',
      horaInicio: '10:00',
    })
    prismaMock.agendamento.count.mockResolvedValue(0)
    prismaMock.agendamento.findFirst.mockResolvedValue(null)
    prismaMock.membro.findUnique.mockResolvedValue({
      id: 'm-1',
      plano: { aulasSemanais: 2 },
      horariosFixos: [
        { diaSemana: 'SEGUNDA', hora: '08:00' },
        { diaSemana: 'QUARTA', hora: '08:00' },
      ],
    })

    const res = await POST(
      createRequest({
        membroId: 'm-1',
        horarioId: 'h-1',
        data: '2025-01-20',
        scope: 'weekly',
      })
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('Limite do plano')
  })

  it('POST creates HorarioFixo when weekly scope is selected', async () => {
    prismaMock.horarioDisponivel.findUnique.mockResolvedValue({
      id: 'h-1',
      ativo: true,
      vagasTotal: 10,
      diaSemana: 'SEGUNDA',
      horaInicio: '10:00',
    })
    prismaMock.agendamento.count.mockResolvedValue(0)
    prismaMock.agendamento.findFirst.mockResolvedValue(null)
    prismaMock.membro.findUnique.mockResolvedValue({
      id: 'm-1',
      plano: { aulasSemanais: 3 },
      horariosFixos: [{ diaSemana: 'SEGUNDA', hora: '08:00' }],
    })
    prismaMock.horarioFixo.findFirst.mockResolvedValue(null)
    prismaMock.horarioFixo.create.mockResolvedValue({ id: 'hf-1' })
    prismaMock.agendamento.create.mockResolvedValue({
      id: 'a-1',
      membroId: 'm-1',
      horarioId: 'h-1',
      data: new Date('2025-01-20T12:00:00'),
      presente: null,
      observacao: null,
      membro: {
        id: 'm-1',
        fotoUrl: null,
        usuario: { nome: 'Aluno', email: 'aluno@example.com' },
      },
      horario: {
        id: 'h-1',
        diaSemana: 'SEGUNDA',
        horaInicio: '10:00',
        horaFim: '11:00',
        vagasTotal: 10,
      },
    })

    const res = await POST(
      createRequest({
        membroId: 'm-1',
        horarioId: 'h-1',
        data: '2025-01-20',
        scope: 'weekly',
      })
    )

    expect(res.status).toBe(201)
    expect(prismaMock.horarioFixo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ membroId: 'm-1', diaSemana: 'SEGUNDA', hora: '10:00' }),
      })
    )
  })
})
