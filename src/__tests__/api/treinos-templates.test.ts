import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/treinos/templates/route'

const {
  sessionRef,
  listTreinoTemplatesMock,
  createTreinoTemplateMock,
  getFichaTreinoWithDetailsMock,
  withApiAuthMock,
  validateRequestMock,
} = vi.hoisted(() => {
  const { createSessionRef, createValidateRequestMock, mockWithApiAuth } = globalThis.__testUtils
  const sessionRef = createSessionRef({ user: { role: 'ADMIN' } })
  return {
    sessionRef,
    listTreinoTemplatesMock: vi.fn(),
    createTreinoTemplateMock: vi.fn(),
    getFichaTreinoWithDetailsMock: vi.fn(),
    withApiAuthMock: mockWithApiAuth(sessionRef).withApiAuth,
    validateRequestMock: createValidateRequestMock(),
  }
})

vi.mock('@/services/treino.service', () => ({
  listTreinoTemplates: listTreinoTemplatesMock,
  createTreinoTemplate: createTreinoTemplateMock,
  getFichaTreinoWithDetails: getFichaTreinoWithDetailsMock,
}))

vi.mock('@/lib/api', () => ({
  withApiAuth: withApiAuthMock,
  validateRequest: validateRequestMock,
}))

describe('Treinos Templates API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionRef.current = { user: { role: 'ADMIN' } }
  })

  it('GET returns templates list', async () => {
    listTreinoTemplatesMock.mockResolvedValueOnce([{ id: 't-1' }])

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(listTreinoTemplatesMock).toHaveBeenCalled()
    expect(json).toEqual([{ id: 't-1' }])
  })

  it('GET returns 403 for non-admin', async () => {
    sessionRef.current = { user: { role: 'MEMBRO' } }

    const res = await GET()

    expect(res.status).toBe(403)
  })

  it('POST returns 400 for invalid payload', async () => {
    const req = new NextRequest('http://localhost:3000/api/treinos/templates', {
      method: 'POST',
      body: JSON.stringify({ nome: '' }),
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    expect(createTreinoTemplateMock).not.toHaveBeenCalled()
  })

  it('POST returns 404 when fichaId is missing', async () => {
    getFichaTreinoWithDetailsMock.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost:3000/api/treinos/templates', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Template', fichaId: 'f-1' }),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toContain('Treino não encontrado')
  })

  it('POST returns 400 when exercises are missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/treinos/templates', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Template' }),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('Informe exercícios')
  })

  it('POST creates template using ficha exercises', async () => {
    getFichaTreinoWithDetailsMock.mockResolvedValueOnce({
      id: 'f-1',
      objetivo: 'Força',
      observacoes: 'Obs',
      exercicios: [
        {
          sessao: 'A',
          nome: 'Supino',
          grupoMuscular: null,
          series: '3',
          repeticoes: '10',
          descanso: null,
          observacoes: null,
        },
      ],
    })
    createTreinoTemplateMock.mockResolvedValueOnce({ id: 't-1' })

    const req = new NextRequest('http://localhost:3000/api/treinos/templates', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Template', fichaId: 'f-1' }),
    })

    const res = await POST(req)

    expect(res.status).toBe(201)
    expect(createTreinoTemplateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: 'Template',
        objetivo: 'Força',
        observacoes: 'Obs',
        exercicios: [
          expect.objectContaining({
            nome: 'Supino',
            series: '3',
            repeticoes: '10',
          }),
        ],
      })
    )
  })
})
