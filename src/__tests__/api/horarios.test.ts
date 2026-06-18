import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/horarios/route'

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
      horarioDisponivel: ['findMany', 'findFirst', 'create'],
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

  it('GET returns 400 for invalid diaSemana', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/horarios?diaSemana=FOO'
    )
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeTruthy()
  })

  it('GET returns 200 with valid diaSemana TERCA', async () => {
    prismaMock.horarioDisponivel.findMany.mockResolvedValue([])

    const req = new NextRequest(
      'http://localhost:3000/api/horarios?diaSemana=TERCA'
    )
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(prismaMock.horarioDisponivel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ diaSemana: 'TERCA' }),
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
