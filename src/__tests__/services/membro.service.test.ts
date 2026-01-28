import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMembroById, listMembros } from '@/services/membro.service'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    membro: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

describe('membro.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listMembros applies status filter and compact select', async () => {
    vi.mocked(prisma.membro.findMany).mockResolvedValueOnce([])

    await listMembros({ status: 'ATIVO', compact: true })

    expect(prisma.membro.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'ATIVO' },
        select: expect.objectContaining({
          id: true,
          usuario: expect.any(Object),
        }),
        orderBy: { criadoEm: 'desc' },
      })
    )
  })

  it('listMembros returns full include when compact is false', async () => {
    vi.mocked(prisma.membro.findMany).mockResolvedValueOnce([])

    await listMembros({})

    expect(prisma.membro.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        include: expect.objectContaining({
          usuario: expect.any(Object),
          plano: true,
        }),
        orderBy: { criadoEm: 'desc' },
      })
    )
  })

  it('getMembroById selects usuario and plano', async () => {
    vi.mocked(prisma.membro.findUnique).mockResolvedValueOnce(null)

    await getMembroById('m-1')

    expect(prisma.membro.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm-1' },
        include: expect.objectContaining({
          usuario: expect.any(Object),
          plano: true,
        }),
      })
    )
  })
})
