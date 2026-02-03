import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { GET, POST } from '@/app/api/treinos/templates/route'

const {
  sessionRef,
  listTreinoTemplatesMock,
  createTreinoTemplateMock,
  getFichaTreinoWithDetailsMock,
  validateRequestMock,
} = vi.hoisted(() => ({
  sessionRef: {
    current: { user: { role: 'ADMIN' as const } },
  } as { current: { user: { role: 'ADMIN' | 'MEMBRO' } } },
  listTreinoTemplatesMock: vi.fn(),
  createTreinoTemplateMock: vi.fn(),
  getFichaTreinoWithDetailsMock: vi.fn(),
  validateRequestMock: vi.fn(
    async (
      request: NextRequest,
      schema: {
        safeParse: (data: unknown) =>
          | { success: true; data: unknown }
          | { success: false; error: { issues: Array<{ message?: string }> } }
      }
    ) => {
      let body: unknown
      try {
        body = await request.json()
      } catch {
        return {
          error: NextResponse.json(
            { error: 'Dados inválidos enviados. Verifique o formulário.' },
            { status: 400 }
          ),
        }
      }

      const validation = schema.safeParse(body)
      if (!validation.success) {
        return {
          error: NextResponse.json(
            { error: validation.error.issues[0]?.message ?? 'Dados inválidos enviados.' },
            { status: 400 }
          ),
        }
      }

      return { data: validation.data }
    }
  ),
}))

vi.mock('@/services/treino.service', () => ({
  listTreinoTemplates: listTreinoTemplatesMock,
  createTreinoTemplate: createTreinoTemplateMock,
  getFichaTreinoWithDetails: getFichaTreinoWithDetailsMock,
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
