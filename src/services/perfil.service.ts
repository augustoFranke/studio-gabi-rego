import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"

type PerfilBaseInput = {
  nome: string
  cpf?: string | null
  rg?: string | null
  telefone?: string | null
  dataNascimento?: string | null
  sexo?: "MASCULINO" | "FEMININO" | null
}

type PerfilSaveParams = PerfilBaseInput & {
  userId: string
  issueAnamneseToken?: boolean
  hasCpf?: boolean
  hasRg?: boolean
  hasTelefone?: boolean
  hasDataNascimento?: boolean
  hasSexo?: boolean
}

type PerfilTokenFlowParams = PerfilBaseInput & {
  token: string
  hasCpf?: boolean
  hasRg?: boolean
  hasTelefone?: boolean
  hasDataNascimento?: boolean
  hasSexo?: boolean
}

type PerfilUpdateParams = {
  userId: string
  nome: string
  telefone?: string | null
  dataNascimento?: string | null
  sexo?: "MASCULINO" | "FEMININO" | null
}

type PerfilSaveResult =
  | { ok: true; anamneseToken: string | null; anamneseTokenExpira: Date | null }
  | { ok: false; status: number; error: string }

type PerfilView = {
  id: string
  nome: string
  email: string
  cpf: string | null
  rg: string | null
  telefone: string | null
  dataNascimento: Date | null
  sexo: "MASCULINO" | "FEMININO" | null
}

function normalizeCpf(value?: string | null) {
  return value ? value.replace(/\D/g, "") : null
}

function normalizeTelefone(value?: string | null) {
  return value ? value.replace(/\D/g, "") : null
}

function normalizeString(value?: string | null) {
  if (value === undefined) return undefined
  if (value === null) return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

function parseDate(value?: string | null) {
  if (value === undefined || value === null || value.trim() === "") {
    return null
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed
}

function createAnamneseToken(issueAnamneseToken: boolean) {
  if (!issueAnamneseToken) {
    return { token: null, expiresAt: null }
  }

  const token = randomBytes(32).toString("hex")
  return {
    token,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  }
}

export async function getPerfilByUsuarioId(userId: string): Promise<PerfilView | null> {
  const membro = await prisma.membro.findUnique({
    where: { usuarioId: userId },
    include: {
      usuario: {
        select: {
          id: true,
          nome: true,
          email: true,
        },
      },
    },
  })

  if (!membro) {
    return null
  }

  return {
    id: membro.id,
    nome: membro.usuario.nome || "",
    email: membro.usuario.email ?? "",
    cpf: membro.cpf,
    rg: membro.rg,
    telefone: membro.telefone,
    dataNascimento: membro.dataNascimento,
    sexo: membro.sexo,
  }
}

export async function savePerfilForUser({
  userId,
  nome,
  cpf,
  rg,
  telefone,
  dataNascimento,
  sexo,
  issueAnamneseToken = false,
  hasCpf = true,
  hasRg = true,
  hasTelefone = true,
  hasDataNascimento = true,
  hasSexo = true,
}: PerfilSaveParams): Promise<PerfilSaveResult> {
  const normalizedCpf = normalizeCpf(cpf)
  const normalizedTelefone = normalizeTelefone(telefone)
  const normalizedRg = normalizeString(rg)
  const normalizedSexo = sexo ?? null
  const normalizedDataNascimento = parseDate(dataNascimento)

  const [existingCpf, existingMembro] = await Promise.all([
    normalizedCpf
      ? prisma.membro.findUnique({ where: { cpf: normalizedCpf } })
      : Promise.resolve(null),
    prisma.membro.findUnique({ where: { usuarioId: userId } }),
  ])

  if (existingCpf && existingCpf.usuarioId !== userId) {
    return {
      ok: false,
      status: 400,
      error: "Este CPF já está cadastrado",
    }
  }

  const { token: anamneseToken, expiresAt: anamneseTokenExpira } =
    createAnamneseToken(issueAnamneseToken)

  await prisma.$transaction(async (tx) => {
    if (existingMembro) {
      await tx.membro.update({
        where: { usuarioId: userId },
        data: {
          ...(hasCpf ? { cpf: normalizedCpf } : {}),
          ...(hasRg ? { rg: normalizedRg } : {}),
          ...(hasTelefone ? { telefone: normalizedTelefone } : {}),
          ...(hasDataNascimento ? { dataNascimento: normalizedDataNascimento } : {}),
          ...(hasSexo ? { sexo: normalizedSexo } : {}),
          ...(issueAnamneseToken
            ? {
                anamneseToken,
                anamneseTokenExpira,
              }
            : {}),
        },
      })
    } else {
      await tx.membro.create({
        data: {
          usuarioId: userId,
          cpf: normalizedCpf,
          rg: normalizedRg,
          telefone: normalizedTelefone,
          dataNascimento: normalizedDataNascimento,
          sexo: normalizedSexo,
          status: "PENDENTE",
          ...(issueAnamneseToken
            ? {
                anamneseToken,
                anamneseTokenExpira,
              }
            : {}),
        },
      })
    }

    await tx.usuario.update({
      where: { id: userId },
      data: {
        nome,
        etapaOnboarding: 3,
        tokenPerfil: null,
        tokenPerfilExpira: null,
      },
    })
  })

  return {
    ok: true,
    anamneseToken,
    anamneseTokenExpira,
  }
}

export async function updatePerfilForUser({
  userId,
  nome,
  telefone,
  dataNascimento,
  sexo,
}: PerfilUpdateParams): Promise<PerfilSaveResult> {
  const existingMembro = await prisma.membro.findUnique({
    where: { usuarioId: userId },
    select: { id: true },
  })

  if (!existingMembro) {
    return {
      ok: false,
      status: 404,
      error: "Perfil não encontrado",
    }
  }

  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: userId },
      data: { nome },
    }),
    prisma.membro.update({
      where: { id: existingMembro.id },
      data: {
        ...(telefone !== undefined ? { telefone: normalizeTelefone(telefone) } : {}),
        ...(dataNascimento !== undefined
          ? { dataNascimento: parseDate(dataNascimento) }
          : {}),
        ...(sexo !== undefined ? { sexo: sexo ?? null } : {}),
      },
    }),
  ])

  return {
    ok: true,
    anamneseToken: null,
    anamneseTokenExpira: null,
  }
}

export async function completePerfilFromToken({
  token,
  ...data
}: PerfilTokenFlowParams): Promise<PerfilSaveResult> {
  const usuario = await prisma.usuario.findUnique({
    where: { tokenPerfil: token },
    select: {
      id: true,
      tokenPerfilExpira: true,
    },
  })

  if (!usuario) {
    return {
      ok: false,
      status: 401,
      error: "Token inválido ou expirado",
    }
  }

  if (usuario.tokenPerfilExpira && usuario.tokenPerfilExpira < new Date()) {
    return {
      ok: false,
      status: 401,
      error: "Token expirado. Faça login novamente.",
    }
  }

  return savePerfilForUser({
    userId: usuario.id,
    issueAnamneseToken: true,
    ...data,
  })
}

export async function createPerfilTokenForMembro(membroId: string) {
  const token = randomBytes(32).toString("hex")
  const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000)

  const membro = await prisma.membro.findUnique({
    where: { id: membroId },
    select: {
      usuarioId: true,
    },
  })

  if (!membro) {
    return null
  }

  await prisma.usuario.update({
    where: { id: membro.usuarioId },
    data: {
      tokenPerfil: token,
      tokenPerfilExpira: tokenExpiry,
    },
  })

  return { token, tokenExpiry }
}

export type { PerfilSaveResult, PerfilView }
