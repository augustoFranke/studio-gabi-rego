import { beforeEach, describe, expect, it, vi } from 'vitest'
import { syncAgendamentosRecorrentes } from '@/services/agendamento.service'
import { prisma } from '@/lib/prisma'
import { MAX_CAPACITY_PER_SLOT } from '@/lib/schedule'

vi.mock('@/lib/prisma', () => {
  const prismaMock = {
    horarioFixo: { findMany: vi.fn() },
    horarioDisponivel: { findMany: vi.fn(), createMany: vi.fn() },
    agendamento: { findMany: vi.fn(), createMany: vi.fn() },
  }
  return {
    prisma: {
      ...prismaMock,
      $transaction: vi.fn(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock)),
    },
  }
})

describe('agendamento.service syncAgendamentosRecorrentes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { created: 0 } and makes no prisma calls when start > end', async () => {
    const result = await syncAgendamentosRecorrentes({
      startDate: new Date('2026-06-07T12:00:00'),
      endDate: new Date('2026-06-01T12:00:00'),
    })

    expect(result).toEqual({ created: 0 })
    expect(prisma.horarioFixo.findMany).not.toHaveBeenCalled()
    expect(prisma.horarioDisponivel.findMany).not.toHaveBeenCalled()
    expect(prisma.agendamento.findMany).not.toHaveBeenCalled()
    expect(prisma.agendamento.createMany).not.toHaveBeenCalled()
  })

  it('returns { created: 0 } when there are no fixed slots, and applies the active-member/membroId filter', async () => {
    vi.mocked(prisma.horarioFixo.findMany).mockResolvedValueOnce([])

    const result = await syncAgendamentosRecorrentes({
      startDate: new Date('2026-06-01T12:00:00'),
      endDate: new Date('2026-06-07T12:00:00'),
    })

    expect(result).toEqual({ created: 0 })
    expect(prisma.horarioFixo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          membro: expect.objectContaining({ status: 'ATIVO' }),
        }),
      })
    )

    vi.mocked(prisma.horarioFixo.findMany).mockResolvedValueOnce([])

    await syncAgendamentosRecorrentes({
      startDate: new Date('2026-06-01T12:00:00'),
      endDate: new Date('2026-06-07T12:00:00'),
      membroId: 'm1',
    })

    expect(prisma.horarioFixo.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          membro: expect.objectContaining({ status: 'ATIVO', id: 'm1' }),
        }),
      })
    )
  })

  it('creates a missing horarioDisponivel slot before scheduling', async () => {
    vi.mocked(prisma.horarioFixo.findMany).mockResolvedValueOnce([
      { membroId: 'm1', diaSemana: 'SEGUNDA', hora: '08:00' },
    ])
    vi.mocked(prisma.horarioDisponivel.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'h1', diaSemana: 'SEGUNDA', horaInicio: '08:00', vagasTotal: MAX_CAPACITY_PER_SLOT },
      ])
    vi.mocked(prisma.agendamento.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.agendamento.createMany).mockResolvedValueOnce({ count: 1 })

    const result = await syncAgendamentosRecorrentes({
      startDate: new Date('2026-06-01T12:00:00'),
      endDate: new Date('2026-06-01T12:00:00'),
    })

    expect(prisma.horarioDisponivel.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            diaSemana: 'SEGUNDA',
            horaInicio: '08:00',
            horaFim: '09:00',
            vagasTotal: MAX_CAPACITY_PER_SLOT,
          }),
        ],
        skipDuplicates: true,
      })
    )
    expect(result).toEqual({ created: 1 })
  })

  it('happy path: creates one booking per matching weekday in the window', async () => {
    vi.mocked(prisma.horarioFixo.findMany).mockResolvedValueOnce([
      { membroId: 'm1', diaSemana: 'SEGUNDA', hora: '08:00' },
    ])
    vi.mocked(prisma.horarioDisponivel.findMany).mockResolvedValueOnce([
      { id: 'h1', diaSemana: 'SEGUNDA', horaInicio: '08:00', vagasTotal: 2 },
    ])
    vi.mocked(prisma.agendamento.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.agendamento.createMany).mockResolvedValueOnce({ count: 2 })

    const result = await syncAgendamentosRecorrentes({
      startDate: new Date('2026-06-01T12:00:00'),
      endDate: new Date('2026-06-14T12:00:00'),
    })

    expect(prisma.agendamento.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ membroId: 'm1', horarioId: 'h1' }),
        ]),
        skipDuplicates: true,
      })
    )
    const createCall = vi.mocked(prisma.agendamento.createMany).mock.calls[0][0]
    expect(createCall.data).toHaveLength(2)
    expect(result).toEqual({ created: 2 })
  })

  it('skips a date where the member already has a booking', async () => {
    vi.mocked(prisma.horarioFixo.findMany).mockResolvedValueOnce([
      { membroId: 'm1', diaSemana: 'SEGUNDA', hora: '08:00' },
    ])
    vi.mocked(prisma.horarioDisponivel.findMany).mockResolvedValueOnce([
      { id: 'h1', diaSemana: 'SEGUNDA', horaInicio: '08:00', vagasTotal: 2 },
    ])
    vi.mocked(prisma.agendamento.findMany).mockResolvedValueOnce([
      { membroId: 'm1', horarioId: 'h1', data: new Date('2026-06-01T12:00:00') },
    ])
    vi.mocked(prisma.agendamento.createMany).mockResolvedValueOnce({ count: 1 })

    const result = await syncAgendamentosRecorrentes({
      startDate: new Date('2026-06-01T12:00:00'),
      endDate: new Date('2026-06-14T12:00:00'),
    })

    const createCall = vi.mocked(prisma.agendamento.createMany).mock.calls[0][0]
    expect(createCall.data).toHaveLength(1)
    expect(result).toEqual({ created: 1 })
  })

  it('respects capacity within the same batch across multiple members', async () => {
    vi.mocked(prisma.horarioFixo.findMany).mockResolvedValueOnce([
      { membroId: 'm1', diaSemana: 'SEGUNDA', hora: '08:00' },
      { membroId: 'm2', diaSemana: 'SEGUNDA', hora: '08:00' },
    ])
    vi.mocked(prisma.horarioDisponivel.findMany).mockResolvedValueOnce([
      { id: 'h1', diaSemana: 'SEGUNDA', horaInicio: '08:00', vagasTotal: 1 },
    ])
    vi.mocked(prisma.agendamento.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.agendamento.createMany).mockResolvedValueOnce({ count: 1 })

    const result = await syncAgendamentosRecorrentes({
      startDate: new Date('2026-06-01T12:00:00'),
      endDate: new Date('2026-06-01T12:00:00'),
    })

    const createCall = vi.mocked(prisma.agendamento.createMany).mock.calls[0][0]
    expect(createCall.data).toHaveLength(1)
    expect(result).toEqual({ created: 1 })
  })

  it('counts pre-existing bookings toward capacity', async () => {
    vi.mocked(prisma.horarioFixo.findMany).mockResolvedValueOnce([
      { membroId: 'm1', diaSemana: 'SEGUNDA', hora: '08:00' },
      { membroId: 'm2', diaSemana: 'SEGUNDA', hora: '08:00' },
    ])
    vi.mocked(prisma.horarioDisponivel.findMany).mockResolvedValueOnce([
      { id: 'h1', diaSemana: 'SEGUNDA', horaInicio: '08:00', vagasTotal: 2 },
    ])
    vi.mocked(prisma.agendamento.findMany).mockResolvedValueOnce([
      { membroId: 'm3', horarioId: 'h1', data: new Date('2026-06-01T12:00:00') },
    ])
    vi.mocked(prisma.agendamento.createMany).mockResolvedValueOnce({ count: 1 })

    const result = await syncAgendamentosRecorrentes({
      startDate: new Date('2026-06-01T12:00:00'),
      endDate: new Date('2026-06-01T12:00:00'),
    })

    const createCall = vi.mocked(prisma.agendamento.createMany).mock.calls[0][0]
    expect(createCall.data).toHaveLength(1)
    expect(result).toEqual({ created: 1 })
  })

  it('returns { created: 0 } and does not call createMany when there is nothing to create', async () => {
    vi.mocked(prisma.horarioFixo.findMany).mockResolvedValueOnce([
      { membroId: 'm1', diaSemana: 'SEGUNDA', hora: '08:00' },
    ])
    vi.mocked(prisma.horarioDisponivel.findMany).mockResolvedValueOnce([
      { id: 'h1', diaSemana: 'SEGUNDA', horaInicio: '08:00', vagasTotal: 1 },
    ])
    vi.mocked(prisma.agendamento.findMany).mockResolvedValueOnce([
      { membroId: 'm1', horarioId: 'h1', data: new Date('2026-06-01T12:00:00') },
    ])

    const result = await syncAgendamentosRecorrentes({
      startDate: new Date('2026-06-01T12:00:00'),
      endDate: new Date('2026-06-01T12:00:00'),
    })

    expect(prisma.agendamento.createMany).not.toHaveBeenCalled()
    expect(result).toEqual({ created: 0 })
  })
})
