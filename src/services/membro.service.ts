import { prisma } from '@/lib/prisma'
import { Prisma, StatusMembro } from '@prisma/client'

export async function listMembros(params: {
  status?: StatusMembro
  compact?: boolean
}) {
  const { status, compact } = params
  const where: Prisma.MembroWhereInput = {}
  if (status) {
    where.status = status
  }

  if (compact) {
    const compactSelect = {
      id: true,
      usuarioId: true,
      cpf: true,
      telefone: true,
      status: true,
      fotoUrl: true,
      usuario: {
        select: {
          nome: true,
          email: true,
        },
      },
    } satisfies Prisma.MembroSelect

    return prisma.membro.findMany({
      where,
      select: compactSelect,
      orderBy: { criadoEm: 'desc' },
    })
  }

  return prisma.membro.findMany({
    where,
    include: {
      usuario: {
        select: {
          id: true,
          nome: true,
          email: true,
        },
      },
      plano: true,
    },
    orderBy: { criadoEm: 'desc' },
  })
}

export async function getMembroById(id: string) {
  return prisma.membro.findUnique({
    where: { id },
    include: {
      usuario: {
        select: {
          id: true,
          nome: true,
          email: true,
        },
      },
      plano: true,
    },
  })
}
