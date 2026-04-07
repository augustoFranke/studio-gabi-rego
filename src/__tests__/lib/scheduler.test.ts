import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StatusEntregaNotificacao, TipoNotificacao } from '@prisma/client'

const {
  prismaMock,
  isEvolutionConfiguredMock,
  formatWhatsappNumberMock,
  sendWhatsappTextMock,
} = vi.hoisted(() => {
  const { createPrismaMock } = globalThis.__testUtils
  const prismaBaseMock = createPrismaMock({
    notificacao: ['findFirst', 'create', 'update'],
    membro: ['findMany'],
  })

  return {
    prismaMock: {
      ...prismaBaseMock,
      $queryRaw: vi.fn(),
    },
    isEvolutionConfiguredMock: vi.fn(),
    formatWhatsappNumberMock: vi.fn(),
    sendWhatsappTextMock: vi.fn(),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/whatsapp/evolution', () => ({
  formatWhatsappNumber: formatWhatsappNumberMock,
  isEvolutionConfigured: isEvolutionConfiguredMock,
  sendWhatsappText: sendWhatsappTextMock,
}))

import { processarAniversarios } from '@/lib/scheduler'

describe('processarAniversarios', () => {
  const now = new Date('2026-02-20T10:30:00Z')
  const expectedTargetDate = '2026-02-20'

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    vi.clearAllMocks()

    isEvolutionConfiguredMock.mockReturnValue(false)
    formatWhatsappNumberMock.mockImplementation((telefone: string) => telefone || null)

    prismaMock.notificacao.findFirst.mockResolvedValue(null)
    prismaMock.notificacao.create.mockResolvedValue({
      id: 'notificacao-1',
      enviada: false,
      statusEntrega: StatusEntregaNotificacao.PENDENTE,
      tentativasEntrega: 0,
    })
    prismaMock.notificacao.update.mockResolvedValue({
      id: 'notificacao-1',
      enviada: true,
      statusEntrega: StatusEntregaNotificacao.ENVIADA,
      tentativasEntrega: 1,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('usa filtro de aniversariantes via prisma.$queryRaw e nao escaneia membros em memoria', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([])

    const summary = await processarAniversarios()

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1)
    expect(prismaMock.membro.findMany).not.toHaveBeenCalled()
    expect(summary).toEqual({
      targetDate: expectedTargetDate,
      candidates: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
    })
  })

  it('mantem dedupe no mesmo dia ao evitar criar notificacao ja enviada', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { id: 'm-1', telefone: '11999999999', usuarioNome: 'Ana', usuarioEmail: 'ana@gabi.dev' },
      { id: 'm-2', telefone: '11888888888', usuarioNome: 'Bia', usuarioEmail: 'bia@gabi.dev' },
    ])

    prismaMock.notificacao.findFirst
      .mockResolvedValueOnce({
        id: 'notificacao-existente',
        enviada: true,
        statusEntrega: StatusEntregaNotificacao.ENVIADA,
        tentativasEntrega: 1,
      })
      .mockResolvedValueOnce(null)

    const summary = await processarAniversarios()

    expect(summary).toEqual({
      targetDate: expectedTargetDate,
      candidates: 2,
      sent: 1,
      skipped: 1,
      failed: 0,
    })
    expect(prismaMock.notificacao.findFirst).toHaveBeenCalledTimes(2)
    expect(prismaMock.notificacao.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.notificacao.update).toHaveBeenCalledTimes(1)
    expect(prismaMock.notificacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          membroId: 'm-2',
          tipo: TipoNotificacao.ANIVERSARIO,
        }),
      })
    )

    const expectedLegacyCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    expect(prismaMock.notificacao.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { chaveDedupe: `aniversario:m-1:${expectedTargetDate}` },
            expect.objectContaining({
              membroId: 'm-1',
              tipo: TipoNotificacao.ANIVERSARIO,
              criadoEm: {
                gte: expectedLegacyCutoff,
              },
            }),
          ]),
        }),
      })
    )
  })

  it('preserva guardas de envio quando telefone esta ausente', async () => {
    isEvolutionConfiguredMock.mockReturnValue(true)
    formatWhatsappNumberMock.mockReturnValueOnce(null)

    prismaMock.$queryRaw.mockResolvedValueOnce([
      { id: 'm-3', telefone: null, usuarioNome: 'Carlos', usuarioEmail: null },
    ])

    const summary = await processarAniversarios()

    expect(prismaMock.notificacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          membroId: 'm-3',
          tipo: TipoNotificacao.ANIVERSARIO,
          canalEmail: false,
        }),
      })
    )
    expect(formatWhatsappNumberMock).toHaveBeenCalledWith('')
    expect(sendWhatsappTextMock).not.toHaveBeenCalled()
    expect(summary).toEqual({
      targetDate: expectedTargetDate,
      candidates: 1,
      sent: 1,
      skipped: 0,
      failed: 0,
    })
  })

  it('reattempts delivery when a previous notification failed', async () => {
    isEvolutionConfiguredMock.mockReturnValue(true)
    formatWhatsappNumberMock.mockReturnValueOnce('5511999999999')
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { id: 'm-4', telefone: '11999999999', usuarioNome: 'Duda', usuarioEmail: null },
    ])
    prismaMock.notificacao.findFirst.mockResolvedValueOnce({
      id: 'notificacao-falha',
      enviada: false,
      statusEntrega: StatusEntregaNotificacao.FALHA,
      tentativasEntrega: 2,
    })
    prismaMock.notificacao.update
      .mockResolvedValueOnce({
        id: 'notificacao-falha',
        enviada: false,
        statusEntrega: StatusEntregaNotificacao.FALHA,
        tentativasEntrega: 2,
      })
      .mockResolvedValueOnce({
        id: 'notificacao-falha',
        enviada: true,
        statusEntrega: StatusEntregaNotificacao.ENVIADA,
        tentativasEntrega: 3,
      })

    const summary = await processarAniversarios()

    expect(prismaMock.notificacao.create).not.toHaveBeenCalled()
    expect(prismaMock.notificacao.update).toHaveBeenCalledTimes(2)
    expect(sendWhatsappTextMock).toHaveBeenCalledTimes(1)
    expect(summary).toEqual({
      targetDate: expectedTargetDate,
      candidates: 1,
      sent: 1,
      skipped: 0,
      failed: 0,
    })
  })
})
