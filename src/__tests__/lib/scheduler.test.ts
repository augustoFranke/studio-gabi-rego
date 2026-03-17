import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TipoNotificacao } from '@prisma/client'

const {
  prismaMock,
} = vi.hoisted(() => {
  const { createPrismaMock } = globalThis.__testUtils
  const prismaBaseMock = createPrismaMock({
    notificacao: ['findFirst', 'create'],
    membro: ['findMany'],
  })

  return {
    prismaMock: {
      ...prismaBaseMock,
      $queryRaw: vi.fn(),
    },
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

import { processarAniversarios } from '@/lib/scheduler'

describe('processarAniversarios', () => {
  const now = new Date('2026-02-20T10:30:00Z')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    vi.clearAllMocks()

    prismaMock.notificacao.findFirst.mockResolvedValue(null)
    prismaMock.notificacao.create.mockResolvedValue({ id: 'notificacao-1' })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('usa filtro de aniversariantes via prisma.$queryRaw e nao escaneia membros em memoria', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([])

    await processarAniversarios()

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1)
    expect(prismaMock.membro.findMany).not.toHaveBeenCalled()
  })

  it('mantem dedupe no mesmo dia ao evitar criar notificacao ja enviada', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { id: 'm-1', usuarioNome: 'Ana', usuarioEmail: 'ana@gabi.dev' },
      { id: 'm-2', usuarioNome: 'Bia', usuarioEmail: 'bia@gabi.dev' },
    ])

    prismaMock.notificacao.findFirst
      .mockResolvedValueOnce({ id: 'notificacao-existente' })
      .mockResolvedValueOnce(null)

    const totalProcessado = await processarAniversarios()

    expect(totalProcessado).toBe(2)
    expect(prismaMock.notificacao.findFirst).toHaveBeenCalledTimes(2)
    expect(prismaMock.notificacao.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.notificacao.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        membroId: 'm-2',
        tipo: TipoNotificacao.ANIVERSARIO,
      }),
    })

    const expectedStartOfToday = new Date(now)
    expectedStartOfToday.setHours(0, 0, 0, 0)

    expect(prismaMock.notificacao.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          membroId: 'm-1',
          tipo: TipoNotificacao.ANIVERSARIO,
          criadoEm: {
            gte: expectedStartOfToday,
          },
        }),
      })
    )
  })
})
