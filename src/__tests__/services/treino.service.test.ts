import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFichaTreino,
  createTreinoTemplate,
  deactivateActiveFichas,
  deleteFichaTreino,
  getFichaTreinoById,
  getFichaTreinoWithDetails,
  listFichasTreino,
  listTreinoTemplates,
  replaceFichaExercicios,
  updateFichaTreino,
} from '@/services/treino.service'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    fichaTreino: {
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    exercicio: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    treinoTemplate: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

describe('treino.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listFichasTreino passes where and include', async () => {
    vi.mocked(prisma.fichaTreino.findMany).mockResolvedValueOnce([])

    await listFichasTreino({ membroId: 'm-1' })

    expect(prisma.fichaTreino.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { membroId: 'm-1' },
        include: expect.any(Object),
        orderBy: { criadoEm: 'desc' },
      })
    )
  })

  it('createFichaTreino maps defaults and exercises', async () => {
    vi.mocked(prisma.fichaTreino.create).mockResolvedValueOnce({ id: 'f-1' })

    await createFichaTreino({
      membroId: 'm-1',
      exercicios: [
        { nome: 'Supino', series: 4, repeticoes: '10', grupoMuscular: 'Peito' },
      ],
    })

    expect(prisma.fichaTreino.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          membroId: 'm-1',
          nome: 'Treino',
          exercicios: {
            create: [
              expect.objectContaining({
                sessao: 'A',
                nome: 'Supino',
                series: '4',
                repeticoes: '10',
                ordem: 0,
              }),
            ],
          },
        }),
        include: expect.any(Object),
      })
    )
  })

  it('deactivateActiveFichas updates active fichas', async () => {
    vi.mocked(prisma.fichaTreino.updateMany).mockResolvedValueOnce({ count: 2 })

    await deactivateActiveFichas('m-1')

    expect(prisma.fichaTreino.updateMany).toHaveBeenCalledWith({
      where: { membroId: 'm-1', ativo: true },
      data: { ativo: false },
    })
  })

  it('getFichaTreinoById selects expected fields', async () => {
    vi.mocked(prisma.fichaTreino.findUnique).mockResolvedValueOnce(null)

    await getFichaTreinoById('f-1')

    expect(prisma.fichaTreino.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'f-1' },
        select: expect.any(Object),
      })
    )
  })

  it('getFichaTreinoWithDetails includes relations', async () => {
    vi.mocked(prisma.fichaTreino.findUnique).mockResolvedValueOnce(null)

    await getFichaTreinoWithDetails('f-1')

    expect(prisma.fichaTreino.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'f-1' },
        include: expect.any(Object),
      })
    )
  })

  it('updateFichaTreino uses select and data', async () => {
    vi.mocked(prisma.fichaTreino.update).mockResolvedValueOnce({ id: 'f-1' })

    await updateFichaTreino('f-1', { nome: 'Novo' })

    expect(prisma.fichaTreino.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'f-1' },
        data: { nome: 'Novo' },
        select: expect.any(Object),
      })
    )
  })

  it('replaceFichaExercicios skips createMany when empty', async () => {
    await replaceFichaExercicios('f-1', [])

    expect(prisma.exercicio.deleteMany).toHaveBeenCalledWith({ where: { fichaId: 'f-1' } })
    expect(prisma.exercicio.createMany).not.toHaveBeenCalled()
  })

  it('replaceFichaExercicios creates exercises with defaults', async () => {
    await replaceFichaExercicios('f-1', [
      { nome: 'Agachamento', repeticoes: '12' },
    ])

    expect(prisma.exercicio.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          fichaId: 'f-1',
          sessao: 'A',
          nome: 'Agachamento',
          series: '3',
          repeticoes: '12',
          ordem: 0,
        }),
      ],
    })
  })

  it('deleteFichaTreino deletes by id', async () => {
    vi.mocked(prisma.fichaTreino.delete).mockResolvedValueOnce({ id: 'f-1' })

    await deleteFichaTreino('f-1')

    expect(prisma.fichaTreino.delete).toHaveBeenCalledWith({ where: { id: 'f-1' } })
  })

  it('listTreinoTemplates includes exercises and order', async () => {
    vi.mocked(prisma.treinoTemplate.findMany).mockResolvedValueOnce([])

    await listTreinoTemplates()

    expect(prisma.treinoTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.any(Object),
        orderBy: { criadoEm: 'desc' },
      })
    )
  })

  it('createTreinoTemplate maps exercises', async () => {
    vi.mocked(prisma.treinoTemplate.create).mockResolvedValueOnce({ id: 't-1' })

    await createTreinoTemplate({
      nome: 'Treino A',
      exercicios: [{ nome: 'Remada', series: '3', repeticoes: '12' }],
    })

    expect(prisma.treinoTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nome: 'Treino A',
          exercicios: {
            create: [
              expect.objectContaining({
                sessao: 'A',
                nome: 'Remada',
                series: '3',
                repeticoes: '12',
                ordem: 0,
              }),
            ],
          },
        }),
        include: expect.any(Object),
      })
    )
  })
})
