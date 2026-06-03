import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { ExercicioInput } from '@/schemas/treino.schema'

const fichaInclude = {
  membro: {
    include: {
      usuario: {
        select: { nome: true },
      },
    },
  },
  exercicios: {
    orderBy: [{ sessao: 'asc' }, { ordem: 'asc' }],
  },
} satisfies Prisma.FichaTreinoInclude

const fichaSelect = {
  id: true,
  nome: true,
  data: true,
  objetivo: true,
  observacoes: true,
  membroId: true,
  membro: {
    select: {
      id: true,
      usuario: {
        select: { nome: true },
      },
    },
  },
  exercicios: {
    select: {
      id: true,
      sessao: true,
      nome: true,
      series: true,
      repeticoes: true,
    },
    orderBy: [{ sessao: 'asc' }, { ordem: 'asc' }],
  },
} satisfies Prisma.FichaTreinoSelect

const mapExerciseToPrisma = (ex: ExercicioInput, index: number) => ({
  sessao: ex.sessao || 'A',
  nome: ex.nome || 'Exercício',
  grupoMuscular: ex.grupoMuscular,
  series: ex.series ? String(ex.series) : '3',
  repeticoes: ex.repeticoes || '10',
  descanso: ex.descanso,
  observacoes: ex.observacoes,
  ordem: index,
})

export async function listFichasTreino(where: Prisma.FichaTreinoWhereInput) {
  return prisma.fichaTreino.findMany({
    where,
    include: fichaInclude,
    orderBy: { criadoEm: 'desc' },
  })
}

export async function createFichaTreino(data: {
  membroId: string
  nome?: string
  data?: string
  objetivo?: string
  observacoes?: string
  exercicios?: ExercicioInput[]
}) {
  const { membroId, nome, data: dataTreino, objetivo, observacoes, exercicios } = data

  return prisma.fichaTreino.create({
    data: {
      membroId,
      nome: nome || 'Treino',
      data: dataTreino,
      objetivo,
      observacoes,
      exercicios: exercicios
        ? {
            create: exercicios.map(mapExerciseToPrisma),
          }
        : undefined,
    },
    include: fichaInclude,
  })
}

export async function deactivateActiveFichas(membroId: string) {
  return prisma.fichaTreino.updateMany({
    where: { membroId, ativo: true },
    data: { ativo: false },
  })
}

export async function getFichaTreinoById(id: string) {
  return prisma.fichaTreino.findUnique({
    where: { id },
    select: fichaSelect,
  })
}

export async function getFichaTreinoWithDetails(id: string) {
  return prisma.fichaTreino.findUnique({
    where: { id },
    include: fichaInclude,
  })
}

export async function updateFichaTreino(id: string, data: Prisma.FichaTreinoUpdateInput) {
  return prisma.fichaTreino.update({
    where: { id },
    data,
    select: fichaSelect,
  })
}

export async function replaceFichaExercicios(
  fichaId: string,
  exercicios: ExercicioInput[]
) {
  if (exercicios.length === 0) {
    await prisma.exercicio.deleteMany({
      where: { fichaId },
    })
    return
  }

  await prisma.exercicio.deleteMany({
    where: { fichaId },
  })

  await prisma.exercicio.createMany({
    data: exercicios.map((ex, index) => ({
      fichaId,
      ...mapExerciseToPrisma(ex, index),
    })),
  })
}

export async function deleteFichaTreino(id: string) {
  return prisma.fichaTreino.delete({
    where: { id },
  })
}

export async function listTreinoTemplates() {
  return prisma.treinoTemplate.findMany({
    include: {
      exercicios: {
        orderBy: [{ sessao: 'asc' }, { ordem: 'asc' }],
      },
    },
    orderBy: { criadoEm: 'desc' },
  })
}

export async function createTreinoTemplate(data: {
  nome: string
  objetivo?: string
  observacoes?: string
  exercicios: ExercicioInput[]
}) {
  return prisma.treinoTemplate.create({
    data: {
      nome: data.nome,
      objetivo: data.objetivo,
      observacoes: data.observacoes,
      exercicios: {
        create: data.exercicios.map(mapExerciseToPrisma),
      },
    },
    include: {
      exercicios: {
        orderBy: [{ sessao: 'asc' }, { ordem: 'asc' }],
      },
    },
  })
}
