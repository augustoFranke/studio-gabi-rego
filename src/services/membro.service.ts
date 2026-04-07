import { prisma } from '@/lib/prisma'
import { normalizeEmailForStorage } from '@/lib/email'
import { validarCPF, validarEmail } from '@/lib/validators'
import { hash } from 'bcryptjs'
import { MembroCreateInput } from '@/schemas/membro.schema'
import { DiaSemana, Prisma, StatusMembro } from '@prisma/client'

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

export type MembroUpdateServiceInput = {
  nome?: string
  email?: string | null
  senha?: string
  cpf?: string | null
  rg?: string | null
  telefone?: string | null
  dataNascimento?: string | null
  planoId?: string
  precoCustomizado?: number | null
  sexo?: 'MASCULINO' | 'FEMININO' | null
  horariosFixos?: Array<{
    diaSemana: DiaSemana
    hora: string
  }>
}

export async function updateMembroById(id: string, input: MembroUpdateServiceInput) {
  const existingMember = await prisma.membro.findUnique({
    where: { id },
    include: { usuario: true },
  })

  if (!existingMember) {
    throw new MembroServiceError('Membro não encontrado', 'MEMBRO_NOT_FOUND', 404)
  }

  const normalizedEmail = input.email === undefined
    ? undefined
    : normalizeEmailForStorage(input.email)

  const cpfLimpo = typeof input.cpf === 'string' && input.cpf
    ? input.cpf.replace(/\D/g, '')
    : input.cpf === null
      ? null
      : undefined

  const [emailExiste, cpfExiste, plano] = await Promise.all([
    normalizedEmail && normalizedEmail !== existingMember.usuario.email
      ? prisma.usuario.findUnique({ where: { email: normalizedEmail } })
      : Promise.resolve(null),
    cpfLimpo && cpfLimpo !== existingMember.cpf
      ? prisma.membro.findUnique({ where: { cpf: cpfLimpo } })
      : Promise.resolve(null),
    input.horariosFixos?.length
      ? prisma.plano.findUnique({
          where: { id: input.planoId ?? existingMember.planoId ?? '' },
          select: { aulasSemanais: true },
        })
      : Promise.resolve(null),
  ])

  if (normalizedEmail && normalizedEmail !== existingMember.usuario.email) {
    if (!validarEmail(normalizedEmail)) {
      throw new MembroServiceError('Email inválido', 'INVALID_EMAIL', 400)
    }
    if (emailExiste) {
      throw new MembroServiceError('Email já cadastrado', 'EMAIL_ALREADY_EXISTS', 400)
    }
  }

  if (cpfLimpo && cpfLimpo !== existingMember.cpf) {
    if (!validarCPF(cpfLimpo)) {
      throw new MembroServiceError('CPF inválido', 'INVALID_CPF', 400)
    }
    if (cpfExiste) {
      throw new MembroServiceError('CPF já cadastrado', 'CPF_ALREADY_EXISTS', 400)
    }
  }

  if (input.horariosFixos?.length && plano && plano.aulasSemanais !== 7) {
    const uniqueSlots = new Set(
      input.horariosFixos.map((horario) => `${horario.diaSemana}-${horario.hora}`)
    )

    if (uniqueSlots.size > plano.aulasSemanais) {
      throw new MembroServiceError(
        `Limite do plano: ${plano.aulasSemanais} aulas por semana. Foram informados ${uniqueSlots.size} horários fixos.`,
        'PLAN_LIMIT_EXCEEDED',
        400
      )
    }
  }

  return prisma.$transaction(async (tx) => {
    const senhaValue = typeof input.senha === 'string' ? input.senha.trim() : ''

    if (input.nome || normalizedEmail !== undefined || senhaValue) {
      const usuarioUpdateData: Prisma.UsuarioUpdateInput = {}
      if (input.nome) usuarioUpdateData.nome = input.nome
      if (normalizedEmail !== undefined) usuarioUpdateData.email = normalizedEmail
      if (senhaValue) {
        usuarioUpdateData.senha = await hash(senhaValue, 12)
        usuarioUpdateData.senhaDefinida = true
      }

      await tx.usuario.update({
        where: { id: existingMember.usuarioId },
        data: usuarioUpdateData,
      })
    }

    const memberUpdateData: Prisma.MembroUpdateInput = {}
    if (input.cpf === null || input.cpf === '') {
      memberUpdateData.cpf = null
    } else if (typeof input.cpf === 'string') {
      memberUpdateData.cpf = input.cpf.replace(/\D/g, '')
    }
    if (input.rg !== undefined) {
      memberUpdateData.rg = input.rg && input.rg.trim() !== '' ? input.rg : null
    }
    if (input.telefone !== undefined) {
      memberUpdateData.telefone = input.telefone ? input.telefone.replace(/\D/g, '') : null
    }
    if (input.dataNascimento !== undefined) {
      memberUpdateData.dataNascimento = input.dataNascimento ? new Date(input.dataNascimento) : null
    }
    if (input.planoId !== undefined) {
      memberUpdateData.plano = input.planoId ? { connect: { id: input.planoId } } : { disconnect: true }
    }
    if (input.precoCustomizado !== undefined) memberUpdateData.precoCustomizado = input.precoCustomizado
    if (input.sexo !== undefined) memberUpdateData.sexo = input.sexo
    if (input.horariosFixos) {
      memberUpdateData.horariosFixos = {
        deleteMany: {},
        create: input.horariosFixos.map((horario) => ({
          diaSemana: horario.diaSemana,
          hora: horario.hora,
        })),
      }
    }

    return tx.membro.update({
      where: { id },
      data: memberUpdateData,
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
