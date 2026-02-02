import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/horarios/get-or-create/route'
import { MAX_CAPACITY_PER_SLOT } from '@/lib/schedule'

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
      horarioDisponivel: ['findFirst', 'create'],
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
