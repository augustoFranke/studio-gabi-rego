import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/perfil/route'

const { prismaMock, authMock, validarCpfMock, randomBytesMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    membro: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
  authMock: vi.fn(),
  validarCpfMock: vi.fn(),
  randomBytesMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}))

vi.mock('@/lib/validators', () => ({
  validarCPF: validarCpfMock,
}))

vi.mock('crypto', () => ({
  randomBytes: randomBytesMock,
}))

describe('Perfil API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createRequest = (body: Record<string, unknown>) =>
    new NextRequest('http://localhost:3000/api/perfil', {
      method: 'POST',
      body: JSON.stringify(body),
    })

  it('returns 400 for invalid payload', async () => {
    const res = await POST(createRequest({ nome: 'ab' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('Nome deve ter pelo menos 3 caracteres')
  })

  it('returns 401 when no session and no token', async () => {
    authMock.mockResolvedValueOnce(null)

    const res = await POST(createRequest({ nome: 'Aluno' }))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toContain('Não autorizado')
  })

  it('returns 401 for invalid token flow', async () => {
    prismaMock.usuario.findUnique.mockResolvedValueOnce(null)

    const res = await POST(createRequest({ token: 'bad', nome: 'Aluno' }))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toContain('Token inválido')
  })

  it('returns 400 for invalid CPF', async () => {
    authMock.mockResolvedValueOnce({ user: { id: 'u-1' } })
    validarCpfMock.mockReturnValueOnce(false)

    const res = await POST(createRequest({ nome: 'Aluno', cpf: '123.456.789-00' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('CPF inválido')
  })

  it('creates new member and sets anamnese cookie for token flow', async () => {
    prismaMock.usuario.findUnique.mockResolvedValueOnce({
      id: 'u-1',
      tokenResetExpira: new Date(Date.now() + 60 * 60 * 1000),
    })
    prismaMock.membro.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    validarCpfMock.mockReturnValueOnce(true)
    randomBytesMock.mockReturnValueOnce(Buffer.from('token'))

    const res = await POST(
      createRequest({ token: 'token', nome: 'Aluno', cpf: '123.456.789-00', telefone: '11999999999' })
    )
    expect(res.status).toBe(200)
    expect(prismaMock.membro.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          usuarioId: 'u-1',
          status: 'PENDENTE',
          anamneseToken: '746f6b656e',
        }),
      })
    )
    expect(prismaMock.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u-1' },
        data: expect.objectContaining({ nome: 'Aluno', etapaOnboarding: 3 }),
      })
    )
    const setCookie = res.headers.get('set-cookie') || ''
    expect(setCookie).toContain('anamnese_token=')
  })
})
