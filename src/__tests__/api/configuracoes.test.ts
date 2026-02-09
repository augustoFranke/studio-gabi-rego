import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, PUT } from '@/app/api/configuracoes/route'

const { sessionRef, prismaMock, withApiAuthMock, validateRequestMock } = vi.hoisted(() => {
  const { createPrismaMock, createSessionRef, mockWithApiAuth, createValidateRequestMock } = globalThis.__testUtils
  const sessionRef = createSessionRef({ user: { role: 'ADMIN' } })
  const basePrismaMock = createPrismaMock({
    configuracao: ['findMany', 'update'],
  })

  const prismaMock = {
    ...basePrismaMock,
    $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  }

  return {
    sessionRef,
    prismaMock,
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

describe('Configuracoes API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionRef.current = { user: { role: 'ADMIN' } }
  })

  it('GET lists settings ordered by chave', async () => {
    prismaMock.configuracao.findMany.mockResolvedValueOnce([])

    const res = await GET()

    expect(res.status).toBe(200)
    expect(prismaMock.configuracao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { chave: 'asc' },
      })
    )
  })

  it('PUT returns 400 for invalid payload', async () => {
    const req = new NextRequest('http://localhost:3000/api/configuracoes', {
      method: 'PUT',
      body: JSON.stringify({}),
    })

    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeTruthy()
  })

  it('PUT updates settings and returns refreshed list', async () => {
    prismaMock.configuracao.update.mockResolvedValue({ id: 'c-1' })
    prismaMock.configuracao.findMany.mockResolvedValueOnce([
      {
        id: 'c-1',
        chave: 'NOME_ESTUDIO',
        valor: 'Studio Gabi',
        descricao: 'Nome do estúdio',
        atualizadoEm: new Date('2026-01-01T00:00:00.000Z'),
      },
    ])

    const req = new NextRequest('http://localhost:3000/api/configuracoes', {
      method: 'PUT',
      body: JSON.stringify({
        configuracoes: [{ id: 'c-1', valor: 'Studio Gabi' }],
      }),
    })

    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.configuracao.update).toHaveBeenCalledWith({
      where: { id: 'c-1' },
      data: { valor: 'Studio Gabi' },
    })
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(json).toHaveLength(1)
  })
})
