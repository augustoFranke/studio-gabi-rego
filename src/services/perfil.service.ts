import { prisma } from "@/lib/prisma"
import { createTimedToken, getTimedTokenLookup, hashTimedToken } from "@/lib/auth-flow"
import { normalizeMemberProfileInput } from "@/lib/member-profile"

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
  profileTokenClaim?: {
    rawToken: string
    hashedToken: string
  }
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

function createAnamneseToken(issueAnamneseToken: boolean) {
  if (!issueAnamneseToken) {
    return { token: null, expiresAt: null }
  }

  return createTimedToken()
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
  profileTokenClaim,
  hasCpf = true,
  hasRg = true,
  hasTelefone = true,
  hasDataNascimento = true,
  hasSexo = true,
}: PerfilSaveParams): Promise<PerfilSaveResult> {
  const {
    cpf: normalizedCpf,
    rg: normalizedRg,
    telefone: normalizedTelefone,
    dataNascimento: normalizedDataNascimento,
    sexo: normalizedSexo,
  } = normalizeMemberProfileInput({ cpf, rg, telefone, dataNascimento, sexo })

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
  const anamneseTokenHash = anamneseToken ? await hashTimedToken(anamneseToken) : null

  await prisma.$transaction(async (tx) => {
    if (profileTokenClaim) {
      const claimed = await tx.usuario.updateMany({
        where: {
          id: userId,
          tokenPerfil: {
            in: [profileTokenClaim.hashedToken, profileTokenClaim.rawToken],
          },
          tokenPerfilExpira: { gt: new Date() },
        },
        data: {
          tokenPerfil: null,
          tokenPerfilExpira: null,
        },
      })

      if (claimed.count !== 1) {
        throw new Error("PROFILE_TOKEN_NOT_CLAIMED")
      }
    }

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
                anamneseToken: anamneseTokenHash,
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
                anamneseToken: anamneseTokenHash,
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

  const normalizedUpdateProfile = normalizeMemberProfileInput({
    telefone,
    dataNascimento,
  })

  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: userId },
      data: { nome },
    }),
    prisma.membro.update({
      where: { id: existingMembro.id },
      data: {
        ...(telefone !== undefined ? { telefone: normalizedUpdateProfile.telefone } : {}),
        ...(dataNascimento !== undefined
          ? { dataNascimento: normalizedUpdateProfile.dataNascimento }
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
  const { rawToken, hashedToken } = await getTimedTokenLookup(token)
  const usuarioQuery = {
    where: { tokenPerfil: { in: [hashedToken, rawToken] } },
    select: {
      id: true,
      tokenPerfilExpira: true,
    },
  }
  const usuario = typeof prisma.usuario.findFirst === 'function'
    ? await prisma.usuario.findFirst(usuarioQuery)
    : await prisma.usuario.findUnique({
        where: { tokenPerfil: rawToken },
        select: usuarioQuery.select,
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

  try {
    return await savePerfilForUser({
      userId: usuario.id,
      issueAnamneseToken: true,
      profileTokenClaim: { rawToken, hashedToken },
      ...data,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "PROFILE_TOKEN_NOT_CLAIMED") {
      return {
        ok: false,
        status: 401,
        error: "Token inválido ou expirado",
      }
    }

    throw error
  }
}

export async function createPerfilTokenForMembro(membroId: string) {
  const { token, expiresAt: tokenExpiry } = createTimedToken()

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
      tokenPerfil: await hashTimedToken(token),
      tokenPerfilExpira: tokenExpiry,
    },
  })

  return { token, tokenExpiry }
}

export type { PerfilSaveResult, PerfilView }
