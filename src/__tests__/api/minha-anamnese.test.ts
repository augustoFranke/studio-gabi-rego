import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { GET, POST } from '@/app/api/minha-anamnese/route'

const { prismaMock, sessionRef, resendMock } = vi.hoisted(() => ({
  prismaMock: {
    membro: {
      findUnique: vi.fn(),
    },
    anamnese: {
      upsert: vi.fn(),
    },
    usuario: {
      update: vi.fn(),
    },
  },
  sessionRef: {
    current: { user: { id: 'u-1', role: 'MEMBRO' as const } },
  } as { current: { user: { id: string; role: 'ADMIN' | 'MEMBRO' } } },
  resendMock: {
    enviarEmail: vi.fn(),
    isResendConfigured: vi.fn(),
    emailTemplates: {
      boasVindas: vi.fn(() => '<p>Oi</p>'),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/resend', () => resendMock)

vi.mock('@/lib/api', () => ({
  withApiAuth: vi.fn(
    async (
      handler: (session: typeof sessionRef.current) => Promise<NextResponse>,
      _options?: { requiredRole?: 'ADMIN' | 'MEMBRO'; requireAuth?: boolean }
    ) => handler(sessionRef.current)
  ),
}))

describe('Minha Anamnese API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionRef.current = { user: { id: 'u-1', role: 'MEMBRO' } }
  })

  it('GET returns 404 when member not found', async () => {
    prismaMock.membro.findUnique.mockResolvedValueOnce(null)

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toContain('Perfil não encontrado')
  })

  it('GET returns sexo and anamnese', async () => {
    prismaMock.membro.findUnique.mockResolvedValueOnce({
      id: 'm-1',
      sexo: 'MASCULINO',
      anamnese: { id: 'a-1' },
    })

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.sexo).toBe('MASCULINO')
    expect(json.anamnese).toEqual({ id: 'a-1' })
  })

  it('POST returns 404 when member not found', async () => {
    prismaMock.membro.findUnique.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost:3000/api/minha-anamnese', {
      method: 'POST',
      body: JSON.stringify({ pesoAtual: '70' }),
    })
    const res = await POST(req)

    expect(res.status).toBe(404)
  })

  it('POST upserts anamnese and sends welcome email when onboarding incomplete', async () => {
    prismaMock.membro.findUnique.mockResolvedValueOnce({
      id: 'm-1',
      usuario: { email: 'user@example.com', nome: 'Aluno', onboardingCompleto: false },
    })
    resendMock.isResendConfigured.mockReturnValueOnce(true)
    resendMock.enviarEmail.mockResolvedValueOnce({ success: true })

    const req = new NextRequest('http://localhost:3000/api/minha-anamnese', {
      method: 'POST',
      body: JSON.stringify({ pesoAtual: '', objetivo: 'Saude' }),
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.anamnese.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ membroId: 'm-1', pesoAtual: null, objetivo: 'Saude' }),
        update: expect.objectContaining({ pesoAtual: null, objetivo: 'Saude' }),
      })
    )
    expect(prismaMock.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ etapaOnboarding: 4 }) })
    )
    expect(resendMock.enviarEmail).toHaveBeenCalled()
    expect(json.success).toBe(true)
  })
})
