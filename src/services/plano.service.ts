import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export class PlanoServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message)
    this.name = 'PlanoServiceError'
  }
}

export type PlanoListParams = {
  includeInactive?: boolean
  includeCounts?: boolean
}

export type PlanoCreateInput = {
  nome: string
  descricao?: string | null
  valor: number
  duracaoDias: number
  aulasSemanais: number
}

export type PlanoUpdateInput = {
  nome?: string
  descricao?: string | null
  valor?: number
  duracaoDias?: number
  aulasSemanais?: number
  ativo?: boolean
}

const planoCountInclude = {
  _count: {
    select: { membros: true, pagamentos: true },
  },
} satisfies Prisma.PlanoInclude

export async function listPlanos(params: PlanoListParams = {}) {
  const { includeInactive = false, includeCounts = false } = params

  return prisma.plano.findMany({
    where: includeInactive ? {} : { ativo: true },
    orderBy: { valor: 'asc' },
    include: includeCounts ? planoCountInclude : undefined,
  })
}

export async function getPlanoById(id: string, includeCounts = false) {
  return prisma.plano.findUnique({
    where: { id },
    include: includeCounts ? planoCountInclude : undefined,
  })
}

export async function createPlano(input: PlanoCreateInput) {
  return prisma.plano.create({
    data: input,
  })
}

export async function updatePlanoById(id: string, input: PlanoUpdateInput) {
  const plano = await prisma.plano.findUnique({ where: { id } })

  if (!plano) {
    throw new PlanoServiceError('Plano não encontrado', 'PLANO_NOT_FOUND', 404)
  }

  return prisma.plano.update({
    where: { id },
    data: {
      ...(input.nome !== undefined && { nome: input.nome }),
      ...(input.descricao !== undefined && { descricao: input.descricao }),
      ...(input.valor !== undefined && { valor: input.valor }),
      ...(input.duracaoDias !== undefined && { duracaoDias: input.duracaoDias }),
      ...(input.aulasSemanais !== undefined && { aulasSemanais: input.aulasSemanais }),
      ...(input.ativo !== undefined && { ativo: input.ativo }),
    },
  })
}

export async function deletePlanoById(id: string) {
  const plano = await prisma.plano.findUnique({ where: { id } })

  if (!plano) {
    throw new PlanoServiceError('Plano não encontrado', 'PLANO_NOT_FOUND', 404)
  }

  const membrosAtivos = await prisma.membro.count({
    where: { planoId: id, status: 'ATIVO' },
  })

  if (membrosAtivos > 0) {
    const planoAtualizado = await prisma.plano.update({
      where: { id },
      data: { ativo: false },
    })

    return {
      action: 'deactivated' as const,
      plano: planoAtualizado,
      membrosAtivos,
    }
  }

  await prisma.plano.delete({ where: { id } })
  return {
    action: 'deleted' as const,
    plano: null,
    membrosAtivos: 0,
  }
}
