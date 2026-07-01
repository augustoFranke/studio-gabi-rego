import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/anamnese-token/route'

const { prismaMock, resendMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn((callbackOrOperations: unknown) => {
      if (typeof callbackOrOperations === 'function') {
        return (callbackOrOperations as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock)
      }
      return Promise.all(callbackOrOperations as Promise<unknown>[])
    }),
    membro: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    anamnese: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
    usuario: {
      update: vi.fn(),
    },
  },
  resendMock: {
    enviarEmail: vi.fn(),
    isResendConfigured: vi.fn(() => true),
    emailTemplates: {
      boasVindas: vi.fn(() => '<p>ok</p>'),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/resend', () => resendMock)

describe('Anamnese Token API - /api/anamnese-token', () => {
  const validToken = 'a'.repeat(64)

  beforeEach(() => {
    vi.clearAllMocks()
    resendMock.isResendConfigured.mockReturnValue(true)
    resendMock.enviarEmail.mockResolvedValue({ success: true })
    prismaMock.membro.updateMany.mockResolvedValue({ count: 1 })
  })

  const reqWithToken = (token: string, init?: RequestInit) =>
    new NextRequest('http://localhost:3000/api/anamnese-token', {
      ...init,
      headers: {
        'X-Anamnese-Token': token,
        ...init?.headers,
      },
    })

  it('GET returns 400 when token is missing', async () => {
    const res = await GET(new NextRequest('http://localhost:3000/api/anamnese-token'))

    expect(res.status).toBe(400)
  })

  it('GET returns 404 when token is invalid or expired', async () => {
    prismaMock.membro.findFirst.mockResolvedValue(null)

    const res = await GET(reqWithToken(validToken))

    expect(res.status).toBe(404)
  })

  it('GET returns null sexo when not set', async () => {
    prismaMock.membro.findFirst.mockResolvedValue({
      id: 'm-1',
      usuarioId: 'u-1',
      sexo: null,
      usuario: { nome: 'Maria Silva', email: 'maria@example.com', onboardingCompleto: false },
      anamnese: null,
    })

    const res = await GET(reqWithToken(validToken))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.sexo).toBeNull()
    expect(json.anamnese).toBeNull()
  })

  it('GET does not disclose existing anamnese answers to bearer token holders', async () => {
    prismaMock.membro.findFirst.mockResolvedValue({
      id: 'm-1',
      usuarioId: 'u-1',
      sexo: 'FEMININO',
      usuario: { nome: 'Maria Silva', email: 'maria@example.com', onboardingCompleto: false },
      anamnese: { id: 'a-1', objetivo: '  Força  ', parq1: 'Sim' },
    })

    const res = await GET(reqWithToken(validToken))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.sexo).toBe('FEMININO')
    expect(json.anamnese).toBeNull()
    expect(prismaMock.anamnese.update).not.toHaveBeenCalled()
  })

  it('POST returns 400 when JSON body is invalid', async () => {
    prismaMock.membro.findFirst.mockResolvedValue({
      id: 'm-1',
      usuarioId: 'u-1',
      sexo: 'FEMININO',
      usuario: { nome: 'Maria', email: 'maria@example.com', onboardingCompleto: false },
      anamnese: null,
    })

    const res = await POST(
      reqWithToken(validToken, {
        method: 'POST',
        // Invalid JSON string will throw during request.json()
        body: '{',
      })
    )

    expect(res.status).toBe(400)
  })

  it('POST saves anamnese, completes onboarding, and sends welcome email once', async () => {
    prismaMock.membro.findFirst.mockResolvedValue({
      id: 'm-1',
      usuarioId: 'u-1',
      sexo: null,
      usuario: { nome: 'Maria', email: 'maria@example.com', onboardingCompleto: false },
      anamnese: null,
    })

    const res = await POST(
      reqWithToken(validToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ altura: '165', pesoAtual: '60', objetivo: 'Força', role: 'MEMBRO' }),
      })
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.anamnese.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { membroId: 'm-1' },
        create: expect.objectContaining({ membroId: 'm-1', altura: '165' }),
      })
    )
    expect(prismaMock.usuario.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: { etapaOnboarding: 4, onboardingCompleto: true },
    })
    expect(prismaMock.membro.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'm-1' }),
        data: { anamneseToken: null, anamneseTokenExpira: null },
      })
    )
    expect(resendMock.enviarEmail).toHaveBeenCalledTimes(1)
    expect(json.success).toBe(true)
  })

  it('POST does not send welcome email when resend is not configured', async () => {
    resendMock.isResendConfigured.mockReturnValue(false)
    prismaMock.membro.findFirst.mockResolvedValue({
      id: 'm-1',
      usuarioId: 'u-1',
      sexo: 'FEMININO',
      usuario: { nome: 'Maria', email: 'maria@example.com', onboardingCompleto: false },
      anamnese: null,
    })

    const res = await POST(
      reqWithToken(validToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ altura: '165' }),
      })
    )

    expect(res.status).toBe(200)
    expect(resendMock.enviarEmail).not.toHaveBeenCalled()
  })

  it('POST does not send welcome email when onboarding is already complete', async () => {
    prismaMock.membro.findFirst.mockResolvedValue({
      id: 'm-1',
      usuarioId: 'u-1',
      sexo: 'FEMININO',
      usuario: { nome: 'Maria', email: 'maria@example.com', onboardingCompleto: true },
      anamnese: { id: 'a-1' },
    })

    const res = await POST(
      reqWithToken(validToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pesoAtual: '61' }),
      })
    )

    expect(res.status).toBe(200)
    expect(resendMock.enviarEmail).not.toHaveBeenCalled()
  })
})
