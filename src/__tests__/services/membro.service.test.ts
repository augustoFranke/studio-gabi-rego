import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAdminMembro, getMembroById, listMembros, MembroServiceError } from '@/services/membro.service'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    membro: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    usuario: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    plano: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(prisma)),
  },
}))

vi.mock('bcryptjs', () => ({
  hash: vi.fn((value: string) => Promise.resolve(`hashed:${value}`)),
}))

vi.mock('@/lib/email', () => ({
  normalizeEmailForStorage: vi.fn((value: string) => value?.trim().toLowerCase() ?? null),
}))

vi.mock('@/lib/validators', () => ({
  validarCPF: vi.fn(() => true),
  validarEmail: vi.fn(() => true),
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

  it('createAdminMembro creates user and member with normalized data', async () => {
    vi.mocked(prisma.usuario.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.membro.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.plano.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.usuario.create).mockResolvedValueOnce({ id: 'u-1' })
    vi.mocked(prisma.membro.create).mockResolvedValueOnce({ id: 'm-1' })

    const member = await createAdminMembro({
      nome: '  Ana  ',
      email: 'ANA@EXAMPLE.COM',
      senha: 'Senha123',
      cpf: '123.456.789-00',
      telefone: '(11) 99999-9999',
      sexo: 'FEMININO',
      horariosFixos: [],
    })

    expect(prisma.usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nome: '  Ana  ',
          email: 'ana@example.com',
          senha: 'hashed:Senha123',
          senhaDefinida: true,
          role: 'MEMBRO',
          onboardingCompleto: true,
          etapaOnboarding: 4,
        }),
      })
    )
    expect(prisma.membro.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          usuarioId: 'u-1',
          cpf: '12345678900',
          telefone: '11999999999',
          sexo: 'FEMININO',
        }),
      })
    )
    expect(member).toEqual({ id: 'm-1' })
  })

  it('createAdminMembro rejects fixed schedules above the plan limit', async () => {
    vi.mocked(prisma.usuario.findUnique).mockReset()
    vi.mocked(prisma.membro.findUnique).mockReset()
    vi.mocked(prisma.plano.findUnique).mockReset()
    vi.mocked(prisma.usuario.create).mockReset()
    vi.mocked(prisma.membro.create).mockReset()

    vi.mocked(prisma.usuario.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.membro.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.plano.findUnique).mockResolvedValueOnce({ aulasSemanais: 2 } as never)
    vi.mocked(prisma.usuario.create).mockResolvedValueOnce({ id: 'u-1' } as never)
    vi.mocked(prisma.membro.create).mockResolvedValueOnce({ id: 'm-1' } as never)

    await expect(
      createAdminMembro({
        nome: 'Ana',
        email: 'ana@example.com',
        senha: 'Senha123',
        cpf: '123.456.789-00',
        planoId: 'plano-1',
        horariosFixos: [
          { diaSemana: 'SEGUNDA', hora: '08:00' },
          { diaSemana: 'TERCA', hora: '09:00' },
          { diaSemana: 'QUARTA', hora: '10:00' },
        ],
      })
    ).rejects.toBeInstanceOf(MembroServiceError)
  })
})
