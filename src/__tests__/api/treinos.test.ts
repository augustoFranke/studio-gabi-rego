import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/treinos/route'

const { prismaMock, sessionRef, withApiAuthMock, validateRequestMock } = vi.hoisted(() => {
  const {
    createPrismaMock,
    createSessionRef,
    createValidateRequestMock,
    mockWithApiAuth,
  } = globalThis.__testUtils
  const sessionRef = createSessionRef()

  return {
    prismaMock: createPrismaMock({
      fichaTreino: ['findMany', 'updateMany', 'create'],
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

describe('Treinos API - /api/treinos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionRef.current = { user: { role: 'ADMIN', membroId: 'm-admin' } }
  })

  it('GET scopes to session membroId for MEMBRO and keeps active-only default', async () => {
    sessionRef.current = { user: { role: 'MEMBRO', membroId: 'm-1' } }
    prismaMock.fichaTreino.findMany.mockResolvedValue([])

    const req = new NextRequest(
      'http://localhost:3000/api/treinos?membroId=m-2'
    )
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(prismaMock.fichaTreino.findMany).toHaveBeenCalled()
    const callArg = prismaMock.fichaTreino.findMany.mock.calls[0][0]
    expect(callArg.where).toMatchObject({ membroId: 'm-1', ativo: true })
  })

  it('GET allows disabling active-only filter via ativos=false', async () => {
    prismaMock.fichaTreino.findMany.mockResolvedValue([])

    const req = new NextRequest('http://localhost:3000/api/treinos?ativos=false')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const callArg = prismaMock.fichaTreino.findMany.mock.calls[0][0]
    expect(callArg.where).not.toHaveProperty('ativo')
  })

  it('POST returns 403 when session is not ADMIN', async () => {
    sessionRef.current = { user: { role: 'MEMBRO', membroId: 'm-1' } }

    const res = await POST(
      new NextRequest('http://localhost:3000/api/treinos', {
        method: 'POST',
        body: JSON.stringify({ membroId: 'm-1' }),
      })
    )

    expect(res.status).toBe(403)
  })

  it('POST returns 400 when membroId is missing', async () => {
    const res = await POST(
      new NextRequest('http://localhost:3000/api/treinos', {
        method: 'POST',
        body: JSON.stringify({
          nome: 'Treino A',
        }),
      })
    )

    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('membroId é obrigatório')
    expect(prismaMock.fichaTreino.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.fichaTreino.create).not.toHaveBeenCalled()
  })

  it('POST deactivates previous plans and creates mapped exercises', async () => {
    prismaMock.fichaTreino.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.fichaTreino.create.mockResolvedValue({ id: 'f-1' })

    const res = await POST(
      new NextRequest('http://localhost:3000/api/treinos', {
        method: 'POST',
        body: JSON.stringify({
          membroId: 'm-1',
          nome: 'Treino A',
          exercicios: [
            { sessao: 'B', nome: 'Agachamento', series: 4, repeticoes: '12', observacoes: 'Subir carga aos poucos' },
            { nome: undefined },
          ],
        }),
      })
    )

    expect(res.status).toBe(201)
    expect(prismaMock.fichaTreino.updateMany).toHaveBeenCalledWith({
      where: { membroId: 'm-1', ativo: true },
      data: { ativo: false },
    })

    const createArg = prismaMock.fichaTreino.create.mock.calls[0][0]
    expect(createArg.data.membroId).toBe('m-1')
    expect(createArg.data.nome).toBe('Treino A')

    const exerciciosCreate = createArg.data.exercicios?.create
    expect(exerciciosCreate).toHaveLength(2)
    expect(exerciciosCreate?.[0]).toMatchObject({
      sessao: 'B',
      nome: 'Agachamento',
      series: '4',
      repeticoes: '12',
      observacoes: 'Subir carga aos poucos',
      ordem: 0,
    })
    expect(exerciciosCreate?.[1]).toMatchObject({
      sessao: 'A',
      nome: 'Exercício',
      series: '3',
      repeticoes: '10',
      ordem: 1,
    })
  })
})
