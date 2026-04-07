import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/minha-anamnese/route'

const { prismaMock, sessionRef, resendMock, withApiAuthMock } = vi.hoisted(() => {
  const { createPrismaMock, createSessionRef, mockWithApiAuth } = globalThis.__testUtils
  const sessionRef = createSessionRef({ user: { id: 'u-1', role: 'MEMBRO' } })
  return {
    prismaMock: Object.assign(
      createPrismaMock({
      membro: ['findUnique'],
      anamnese: ['upsert', 'update'],
      usuario: ['update'],
      }),
      { $transaction: vi.fn() }
    ),
    sessionRef,
    resendMock: {
      enviarEmail: vi.fn(),
      isResendConfigured: vi.fn(),
      emailTemplates: {
        boasVindas: vi.fn(() => '<p>Oi</p>'),
      },
    },
    withApiAuthMock: mockWithApiAuth(sessionRef).withApiAuth,
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/resend', () => resendMock)

vi.mock('@/lib/api', () => ({
  withApiAuth: withApiAuthMock,
}))

describe('Minha Anamnese API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionRef.current = { user: { id: 'u-1', role: 'MEMBRO' } }
    prismaMock.$transaction.mockImplementation((operations: Promise<unknown>[]) => Promise.all(operations))
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
      anamnese: { id: 'a-1', objetivo: '  Saúde  ', experienciaMusculacao: '  Intermediário  ', parq1: 'Sim' },
    })

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.sexo).toBe('MASCULINO')
    expect(json.anamnese).toMatchObject({
      objetivo: 'Saúde',
      experienciaMusculacao: 'Intermediário',
      parq1: 'Sim',
    })
    expect(prismaMock.anamnese.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { membroId: 'm-1' },
        data: expect.objectContaining({
          objetivo: 'Saúde',
          experienciaMusculacao: 'Intermediário',
          parq1: 'Sim',
        }),
      })
    )
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
    const upsertPayload = vi.mocked(prismaMock.anamnese.upsert).mock.calls[0][0]
    expect(upsertPayload.create).toMatchObject({
      altura: null,
      parq7: null,
    })
    expect(prismaMock.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ etapaOnboarding: 4 }) })
    )
    expect(resendMock.enviarEmail).toHaveBeenCalled()
    expect(json.success).toBe(true)
  })

  it('POST ignores unknown fields and keeps canonical null defaults', async () => {
    prismaMock.membro.findUnique.mockResolvedValueOnce({
      id: 'm-1',
      usuario: { email: 'user@example.com', nome: 'Aluno', onboardingCompleto: true },
    })

    const req = new NextRequest('http://localhost:3000/api/minha-anamnese', {
      method: 'POST',
      body: JSON.stringify({ objetivo: 'Saude', role: 'ADMIN' }),
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(prismaMock.anamnese.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          objetivo: 'Saude',
          altura: null,
        }),
      })
    )
  })

  it('POST persists medical history, experience, and PAR-Q fields', async () => {
    prismaMock.membro.findUnique.mockResolvedValueOnce({
      id: 'm-1',
      usuario: { email: 'user@example.com', nome: 'Aluno', onboardingCompleto: true },
    })

    const req = new NextRequest('http://localhost:3000/api/minha-anamnese', {
      method: 'POST',
      body: JSON.stringify({
        condicaoMedica: 'Sim',
        condicaoMedicaQual: 'Asma',
        experienciaMusculacao: 'Intermediário',
        expectativas: 'Ganhar força',
        parq1: 'Não',
        parq7: 'Sim',
      }),
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(prismaMock.anamnese.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          membroId: 'm-1',
          condicaoMedica: 'Sim',
          condicaoMedicaQual: 'Asma',
          experienciaMusculacao: 'Intermediário',
          expectativas: 'Ganhar força',
          parq1: 'Não',
          parq7: 'Sim',
        }),
        update: expect.objectContaining({
          condicaoMedica: 'Sim',
          condicaoMedicaQual: 'Asma',
          experienciaMusculacao: 'Intermediário',
          expectativas: 'Ganhar força',
          parq1: 'Não',
          parq7: 'Sim',
        }),
      })
    )
  })
})
