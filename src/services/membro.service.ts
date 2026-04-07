import { prisma } from '@/lib/prisma'
import { normalizeEmailForStorage } from '@/lib/email'
import { validarCPF, validarEmail } from '@/lib/validators'
import { hash } from 'bcryptjs'
import { MembroCreateInput } from '@/schemas/membro.schema'
import { Prisma, StatusMembro } from '@prisma/client'

export class MembroServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message)
    this.name = 'MembroServiceError'
  }
}

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

export async function createAdminMembro(input: MembroCreateInput) {
  const {
    nome,
    email,
    senha,
    cpf,
    rg,
    telefone,
    dataNascimento,
    planoId,
    precoCustomizado,
    sexo,
    horariosFixos,
  } = input

  const senhaValue = typeof senha === 'string' ? senha.trim() : ''
  const senhaDefinida = Boolean(senhaValue)
  const normalizedEmail = normalizeEmailForStorage(email)

  if (normalizedEmail && !validarEmail(normalizedEmail)) {
    throw new MembroServiceError('O email informado é inválido.', 'INVALID_EMAIL', 400)
  }

  if (cpf && !validarCPF(cpf)) {
    throw new MembroServiceError('O CPF informado é inválido.', 'INVALID_CPF', 400)
  }

  const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : null

  const [emailExiste, cpfExiste, plano] = await Promise.all([
    normalizedEmail
      ? prisma.usuario.findUnique({ where: { email: normalizedEmail } })
      : null,
    cpfLimpo
      ? prisma.membro.findUnique({ where: { cpf: cpfLimpo } })
      : null,
    horariosFixos?.length && planoId
      ? prisma.plano.findUnique({ where: { id: planoId }, select: { aulasSemanais: true } })
      : null,
  ])

  if (normalizedEmail && emailExiste) {
    throw new MembroServiceError(
      'Este email já está cadastrado no sistema.',
      'EMAIL_ALREADY_EXISTS',
      400
    )
  }

  if (cpfLimpo && cpfExiste) {
    throw new MembroServiceError(
      'Este CPF já está cadastrado para outro membro.',
      'CPF_ALREADY_EXISTS',
      400
    )
  }

  if (horariosFixos?.length && planoId && plano && plano.aulasSemanais !== 7) {
    const uniqueSlots = new Set(
      horariosFixos.map((horario) => `${horario.diaSemana}-${horario.hora}`)
    )
    const totalSlots = uniqueSlots.size

    if (totalSlots > plano.aulasSemanais) {
      throw new MembroServiceError(
        `Limite do plano: ${plano.aulasSemanais} aulas por semana. Foram informados ${totalSlots} horários fixos.`,
        'PLAN_LIMIT_EXCEEDED',
        400
      )
    }
  }

  const senhaHash = senhaDefinida ? await hash(senhaValue, 12) : await hash(Math.random().toString(36), 12)

  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: {
        nome: nome || 'Sem nome',
        email: normalizedEmail,
        senha: senhaHash,
        senhaDefinida,
        role: 'MEMBRO',
        onboardingCompleto: true,
        etapaOnboarding: 4,
      },
    })

    return tx.membro.create({
      data: {
        usuarioId: usuario.id,
        cpf: cpfLimpo,
        rg,
        telefone: telefone ? telefone.replace(/\D/g, '') : null,
        dataNascimento: dataNascimento ? new Date(dataNascimento) : null,
        planoId,
        precoCustomizado,
        sexo,
        status: 'ATIVO',
        horariosFixos: horariosFixos?.length
          ? {
              create: horariosFixos.map((horario) => ({
                diaSemana: horario.diaSemana,
                hora: horario.hora,
              })),
            }
          : undefined,
      },
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
  })
}
