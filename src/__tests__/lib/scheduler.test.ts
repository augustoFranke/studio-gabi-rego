import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TipoNotificacao } from '@prisma/client'

const {
  prismaMock,
  isResendConfiguredMock,
  enviarEmailMock,
  aniversarioTemplateMock,
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
    isResendConfiguredMock: vi.fn(),
    enviarEmailMock: vi.fn(),
    aniversarioTemplateMock: vi.fn(),
    isEvolutionConfiguredMock: vi.fn(),
    formatWhatsappNumberMock: vi.fn(),
    sendWhatsappTextMock: vi.fn(),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/resend', () => ({
  enviarEmail: enviarEmailMock,
  emailTemplates: {
    aniversario: aniversarioTemplateMock,
  },
  isResendConfigured: isResendConfiguredMock,
}))

vi.mock('@/lib/whatsapp/evolution', () => ({
  formatWhatsappNumber: formatWhatsappNumberMock,
  isEvolutionConfigured: isEvolutionConfiguredMock,
  sendWhatsappText: sendWhatsappTextMock,
}))

import { processarAniversarios } from '@/lib/scheduler'

describe('processarAniversarios', () => {
  const now = new Date('2026-02-20T10:30:00Z')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    vi.clearAllMocks()

    isResendConfiguredMock.mockReturnValue(false)
    isEvolutionConfiguredMock.mockReturnValue(false)
    formatWhatsappNumberMock.mockImplementation((telefone: string) => telefone || null)
    aniversarioTemplateMock.mockImplementation((nome: string) => `<p>Feliz aniversario ${nome}</p>`)

    prismaMock.notificacao.findFirst.mockResolvedValue(null)
    prismaMock.notificacao.create.mockResolvedValue({ id: 'notificacao-1' })
    prismaMock.notificacao.update.mockResolvedValue({ id: 'notificacao-1', enviada: true })
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
      { id: 'm-1', telefone: '11999999999', usuarioNome: 'Ana', usuarioEmail: 'ana@gabi.dev' },
      { id: 'm-2', telefone: '11888888888', usuarioNome: 'Bia', usuarioEmail: 'bia@gabi.dev' },
    ])

    prismaMock.notificacao.findFirst
      .mockResolvedValueOnce({ id: 'notificacao-existente' })
      .mockResolvedValueOnce(null)

    const totalProcessado = await processarAniversarios()

    expect(totalProcessado).toBe(2)
    expect(prismaMock.notificacao.findFirst).toHaveBeenCalledTimes(2)
    expect(prismaMock.notificacao.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.notificacao.update).toHaveBeenCalledTimes(1)
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

  it('preserva guardas de envio quando email e telefone estao ausentes', async () => {
    isResendConfiguredMock.mockReturnValue(true)
    isEvolutionConfiguredMock.mockReturnValue(true)
    formatWhatsappNumberMock.mockReturnValueOnce(null)

    prismaMock.$queryRaw.mockResolvedValueOnce([
      { id: 'm-3', telefone: null, usuarioNome: 'Carlos', usuarioEmail: null },
    ])

    await processarAniversarios()

    expect(prismaMock.notificacao.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        membroId: 'm-3',
        tipo: TipoNotificacao.ANIVERSARIO,
        canalEmail: true,
        canalWhatsapp: true,
      }),
    })
    expect(aniversarioTemplateMock).not.toHaveBeenCalled()
    expect(enviarEmailMock).not.toHaveBeenCalled()
    expect(formatWhatsappNumberMock).toHaveBeenCalledWith('')
    expect(sendWhatsappTextMock).not.toHaveBeenCalled()
  })
})
