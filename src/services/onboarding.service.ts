import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import {
  extractCanonicalAnamneseData,
  normalizeAnamneseRecord,
  sanitizeAnamnesePayload,
  type CanonicalAnamneseData,
} from "@/lib/anamnese"
import { enviarEmail, emailTemplates, isResendConfigured } from "@/lib/resend"
import { createTimedToken, getAppBaseUrl, getTimedTokenLookup, hashTimedToken } from "@/lib/auth-flow"
import { normalizeMemberProfileInput } from "@/lib/member-profile"

const TOKEN_EXPIRY_ERROR = "Link inválido ou expirado. Solicite um novo link."

import { ServiceError as OnboardingServiceError } from './errors'
export { ServiceError as OnboardingServiceError } from './errors'

export type SignupInput = {
  email: string
  senha: string
  nome?: string
  cpf?: string | null
  rg?: string | null
  telefone?: string | null
  dataNascimento?: string | null
  sexo?: "MASCULINO" | "FEMININO" | null
  anamnese?: Partial<CanonicalAnamneseData>
}

export type VerificationStep =
  | "dashboard"
  | "login"
  | "set_password"
  | "complete_profile"
  | "complete_anamnese"

export type VerifyEmailResult = {
  success: true
  message: string
  isAdmin: boolean
  nextStep: VerificationStep
  redirectUrl: string
}

export type GenericSuccessResult = {
  success: true
  message: string
}

function queueWelcomeEmail(nome: string | null | undefined, email: string | null | undefined) {
  if (!email || !isResendConfigured()) {
    return
  }

  void enviarEmail({
    para: email,
    assunto: "Bem-vindo(a) ao Studio Gabi Rego",
    html: emailTemplates.boasVindas(nome || "Aluno(a)"),
  }).catch((error) => {
    console.error("Failed to send welcome email:", error)
  })
}

async function sendVerificationEmail(params: {
  email: string
  nome?: string | null
  verificationToken: string
  origin?: string
}) {
  if (!isResendConfigured()) {
    throw new OnboardingServiceError(
      "Serviço de email não configurado. Contate o suporte.",
      "EMAIL_NOT_CONFIGURED",
      500
    )
  }

  const verificationLink = `${getAppBaseUrl(params.origin)}/verificar-email/${params.verificationToken}`
  const result = await enviarEmail({
    para: params.email,
    assunto: "Verifique seu email - Gabi Studio",
    html: emailTemplates.verificacaoEmail(params.nome ?? null, verificationLink),
  })

  if (!result.success) {
    throw new OnboardingServiceError(
      "Não foi possível enviar o email agora. Tente novamente.",
      "EMAIL_SEND_FAILED",
      500
    )
  }
}

async function issueProfileTokenForUser(userId: string) {
  const { token, expiresAt } = createTimedToken()
  const tokenHash = await hashTimedToken(token)

  await prisma.usuario.update({
    where: { id: userId },
    data: {
      tokenPerfil: tokenHash,
      tokenPerfilExpira: expiresAt,
    },
  })

  return { token, expiresAt }
}

async function issueAnamneseTokenForMembro(membroId: string) {
  const { token, expiresAt } = createTimedToken()
  const tokenHash = await hashTimedToken(token)

  await prisma.membro.update({
    where: { id: membroId },
    data: {
      anamneseToken: tokenHash,
      anamneseTokenExpira: expiresAt,
    },
  })

  return { token, expiresAt }
}

function getVerificationOutcomePath(params: {
  baseUrl: string
  isAdmin: boolean
  profileToken?: string | null
  anamneseToken?: string | null
  passwordSetupToken?: string | null
}) {
  if (params.isAdmin) {
    return {
      nextStep: "dashboard" as const,
      redirectUrl: `${params.baseUrl}/dashboard`,
    }
  }

  if (params.passwordSetupToken) {
    return {
      nextStep: "set_password" as const,
      redirectUrl: `${params.baseUrl}/redefinir-senha/${encodeURIComponent(params.passwordSetupToken)}`,
    }
  }

  if (params.profileToken) {
    return {
      nextStep: "complete_profile" as const,
      redirectUrl: `${params.baseUrl}/completar-perfil?token=${encodeURIComponent(params.profileToken)}`,
    }
  }

  if (params.anamneseToken) {
    return {
      nextStep: "complete_anamnese" as const,
      redirectUrl: `${params.baseUrl}/anamnese#token=${encodeURIComponent(params.anamneseToken)}`,
    }
  }

  return {
    nextStep: "login" as const,
    redirectUrl: `${params.baseUrl}/login`,
  }
}

export async function registerUser(input: SignupInput, origin?: string): Promise<GenericSuccessResult> {
  const normalizedEmail = input.email.toLowerCase().trim()
  const fullNome = input.nome?.trim()
  const hasFullPayload = Boolean(fullNome && input.anamnese)
  const normalizedMemberProfile = normalizeMemberProfileInput({
    cpf: input.cpf,
    rg: input.rg,
    telefone: input.telefone,
    dataNascimento: input.dataNascimento,
    sexo: input.sexo,
  })

  const existingUser = await prisma.usuario.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      nome: true,
      emailVerificado: true,
      onboardingCompleto: true,
      membro: { select: { id: true } },
    },
  })

  if (existingUser?.emailVerificado) {
    return {
      success: true,
      message: "Se o email existir, enviaremos instruções.",
    }
  }

  const { token: verificationToken, expiresAt: tokenExpiry } = createTimedToken()
  const verificationTokenHash = await hashTimedToken(verificationToken)
  const inertPasswordHash = await hash(`${verificationToken}:pending-password`, 12)

  if (existingUser) {
    await prisma.usuario.update({
      where: { id: existingUser.id },
      data: {
        senha: inertPasswordHash,
        senhaDefinida: false,
        tokenVerificacao: verificationTokenHash,
        tokenVerificacaoExpira: tokenExpiry,
      },
    })
  } else if (hasFullPayload && fullNome && input.anamnese) {
    await prisma.$transaction(async (tx) => {
      const user = await tx.usuario.create({
        data: {
          email: normalizedEmail,
          nome: fullNome,
          senha: inertPasswordHash,
          senhaDefinida: false,
          role: "MEMBRO",
          tokenVerificacao: verificationTokenHash,
          tokenVerificacaoExpira: tokenExpiry,
          etapaOnboarding: 1,
          onboardingCompleto: false,
        },
      })

      const membro = await tx.membro.create({
        data: {
          usuarioId: user.id,
          cpf: normalizedMemberProfile.cpf,
          rg: normalizedMemberProfile.rg ?? null,
          telefone: normalizedMemberProfile.telefone,
          dataNascimento: normalizedMemberProfile.dataNascimento,
          sexo: normalizedMemberProfile.sexo,
          status: "PENDENTE",
        },
      })

      await tx.anamnese.create({
        data: {
          membroId: membro.id,
          ...input.anamnese,
        },
      })
    })
  } else {
    await prisma.usuario.create({
      data: {
        email: normalizedEmail,
        senha: inertPasswordHash,
        senhaDefinida: false,
        role: "MEMBRO",
        tokenVerificacao: verificationTokenHash,
        tokenVerificacaoExpira: tokenExpiry,
        etapaOnboarding: 1,
        onboardingCompleto: false,
      },
    })
  }

  await sendVerificationEmail({
    email: normalizedEmail,
    nome: hasFullPayload ? fullNome : null,
    verificationToken,
    origin,
  })

  return {
    success: true,
    message: "Se o email existir, enviaremos instruções.",
  }
}

export async function verifyEmailToken(token: string, origin?: string): Promise<VerifyEmailResult> {
  const { rawToken, hashedToken } = await getTimedTokenLookup(token)
  const usuarioQuery = {
    where: { tokenVerificacao: { in: [hashedToken, rawToken] } },
    include: {
      membro: {
        select: {
          id: true,
          anamnese: { select: { id: true } },
        },
      },
    },
  }
  const usuario = typeof prisma.usuario.findFirst === 'function'
    ? await prisma.usuario.findFirst(usuarioQuery)
    : await prisma.usuario.findUnique({
        where: { tokenVerificacao: rawToken },
        include: usuarioQuery.include,
      })

  if (!usuario) {
    throw new OnboardingServiceError("Token inválido", "INVALID_TOKEN", 400)
  }

  if (usuario.tokenVerificacaoExpira && usuario.tokenVerificacaoExpira < new Date()) {
    throw new OnboardingServiceError("Token expirado", "EXPIRED_TOKEN", 400)
  }

  const baseUrl = getAppBaseUrl(origin)
  const shouldSendWelcome = !usuario.onboardingCompleto
  let profileToken: string | null = null
  let anamneseToken: string | null = null
  let passwordSetupToken: string | null = null

  if (usuario.role === "ADMIN") {
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        emailVerificado: new Date(),
        tokenVerificacao: null,
        tokenVerificacaoExpira: null,
        etapaOnboarding: 4,
        onboardingCompleto: true,
      },
    })
  } else if (!usuario.senhaDefinida) {
    const passwordSetup = createTimedToken()
    passwordSetupToken = passwordSetup.token

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        emailVerificado: new Date(),
        tokenVerificacao: null,
        tokenVerificacaoExpira: null,
        tokenReset: await hashTimedToken(passwordSetup.token),
        tokenResetExpira: passwordSetup.expiresAt,
      },
    })
  } else if (!usuario.membro) {
    const profile = await issueProfileTokenForUser(usuario.id)
    profileToken = profile.token

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        emailVerificado: new Date(),
        tokenVerificacao: null,
        tokenVerificacaoExpira: null,
        etapaOnboarding: 2,
        onboardingCompleto: false,
      },
    })
  } else if (!usuario.membro.anamnese) {
    const anamnese = await issueAnamneseTokenForMembro(usuario.membro.id)
    anamneseToken = anamnese.token

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        emailVerificado: new Date(),
        tokenVerificacao: null,
        tokenVerificacaoExpira: null,
        etapaOnboarding: 3,
        onboardingCompleto: false,
      },
    })
  } else {
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        emailVerificado: new Date(),
        tokenVerificacao: null,
        tokenVerificacaoExpira: null,
        tokenPerfil: null,
        tokenPerfilExpira: null,
        etapaOnboarding: 4,
        onboardingCompleto: true,
      },
    })
  }

  if (
    shouldSendWelcome &&
    (usuario.role === "ADMIN" || (usuario.membro && usuario.membro.anamnese))
  ) {
    queueWelcomeEmail(usuario.nome, usuario.email)
  }

  const { nextStep, redirectUrl } = getVerificationOutcomePath({
    baseUrl,
    isAdmin: usuario.role === "ADMIN",
    profileToken,
    anamneseToken,
    passwordSetupToken,
  })

  return {
    success: true,
    message: "Email verificado com sucesso!",
    isAdmin: usuario.role === "ADMIN",
    nextStep,
    redirectUrl,
  }
}

export async function resendVerificationEmail(email: string, origin?: string): Promise<GenericSuccessResult> {
  const normalizedEmail = email.toLowerCase().trim()

  const usuario = await prisma.usuario.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      nome: true,
      emailVerificado: true,
      onboardingCompleto: true,
      membro: { select: { id: true } },
    },
  })

  if (!usuario || usuario.emailVerificado) {
    return {
      success: true,
      message: "Se o email existir, um novo link será enviado.",
    }
  }

  const { token: verificationToken, expiresAt: tokenExpiry } = createTimedToken()

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      tokenVerificacao: await hashTimedToken(verificationToken),
      tokenVerificacaoExpira: tokenExpiry,
    },
  })

  if (isResendConfigured()) {
    await enviarEmail({
      para: normalizedEmail,
      assunto: "Verifique seu email - Gabi Studio",
      html: emailTemplates.verificacaoEmail(
        usuario.nome ?? null,
        `${getAppBaseUrl(origin)}/verificar-email/${verificationToken}`
      ),
    })
  } else {
    console.warn("Resend não configurado - envio de email ignorado.")
  }

  return {
    success: true,
    message: "Se o email existir, um novo link será enviado.",
  }
}

export async function getAnamneseByToken(token: string) {
  const { rawToken, hashedToken } = await getTimedTokenLookup(token)
  const membro = await prisma.membro.findFirst({
    where: {
      anamneseToken: { in: [hashedToken, rawToken] },
      anamneseTokenExpira: { gt: new Date() },
    },
    include: {
      usuario: { select: { nome: true, email: true, onboardingCompleto: true } },
      anamnese: true,
    },
  })

  if (!membro) {
    throw new OnboardingServiceError(TOKEN_EXPIRY_ERROR, "INVALID_ANAMNESE_TOKEN", 404)
  }

  const normalized = normalizeAnamneseRecord(
    extractCanonicalAnamneseData(membro.anamnese)
  )

  if ("error" in normalized) {
    throw new OnboardingServiceError("Dados de anamnese inválidos", "INVALID_ANAMNESE", 500)
  }

  if (membro.anamnese && normalized.changed) {
    await prisma.anamnese.update({
      where: { membroId: membro.id },
      data: normalized.data,
    })
  }

  return {
    sexo: membro.sexo ?? null,
    anamnese: membro.anamnese ? normalized.data : null,
  }
}

async function saveAnamneseForMembro(params: {
  membroId: string
  usuarioId: string
  nome?: string | null
  email?: string | null
  onboardingCompleto: boolean
  payload: unknown
  clearToken?: boolean
}) {
  const sanitized = sanitizeAnamnesePayload(params.payload, {
    ignoreUnknownFields: true,
    fillMissingFields: true,
  })

  if ("error" in sanitized) {
    throw new OnboardingServiceError("Dados inválidos enviados", "INVALID_ANAMNESE_PAYLOAD", 400)
  }

  if (sanitized.ignoredKeys.length > 0) {
    console.warn("[anamnese_sanitize] Campos ignorados:", sanitized.ignoredKeys)
  }

  const shouldSendWelcome = !params.onboardingCompleto

  await prisma.$transaction([
    prisma.anamnese.upsert({
      where: { membroId: params.membroId },
      create: {
        membroId: params.membroId,
        ...sanitized.data,
      },
      update: sanitized.data,
    }),
    prisma.usuario.update({
      where: { id: params.usuarioId },
      data: {
        etapaOnboarding: 4,
        onboardingCompleto: true,
      },
    }),
    ...(params.clearToken
      ? [
          prisma.membro.update({
            where: { id: params.membroId },
            data: {
              anamneseToken: null,
              anamneseTokenExpira: null,
            },
          }),
        ]
      : []),
  ])

  if (shouldSendWelcome) {
    queueWelcomeEmail(params.nome, params.email)
  }

  return {
    success: true,
    message: "Anamnese salva com sucesso!",
  }
}

export async function saveAnamneseByToken(token: string, payload: unknown) {
  const { rawToken, hashedToken } = await getTimedTokenLookup(token)
  const sanitized = sanitizeAnamnesePayload(payload, {
    ignoreUnknownFields: true,
    fillMissingFields: true,
  })

  if ("error" in sanitized) {
    throw new OnboardingServiceError("Dados inválidos enviados", "INVALID_ANAMNESE_PAYLOAD", 400)
  }

  if (sanitized.ignoredKeys.length > 0) {
    console.warn("[anamnese_sanitize] Campos ignorados:", sanitized.ignoredKeys)
  }

  const membro = await prisma.membro.findFirst({
    where: {
      anamneseToken: { in: [hashedToken, rawToken] },
      anamneseTokenExpira: { gt: new Date() },
    },
    include: {
      usuario: { select: { nome: true, email: true, onboardingCompleto: true } },
    },
  })

  if (!membro) {
    throw new OnboardingServiceError(TOKEN_EXPIRY_ERROR, "INVALID_ANAMNESE_TOKEN", 404)
  }

  const shouldSendWelcome = !membro.usuario.onboardingCompleto

  await prisma.$transaction(async (tx) => {
    const consumed = await tx.membro.updateMany({
      where: {
        id: membro.id,
        anamneseToken: { in: [hashedToken, rawToken] },
        anamneseTokenExpira: { gt: new Date() },
      },
      data: {
        anamneseToken: null,
        anamneseTokenExpira: null,
      },
    })

    if (consumed.count !== 1) {
      throw new OnboardingServiceError(TOKEN_EXPIRY_ERROR, "INVALID_ANAMNESE_TOKEN", 404)
    }

    await tx.anamnese.upsert({
      where: { membroId: membro.id },
      create: {
        membroId: membro.id,
        ...sanitized.data,
      },
      update: sanitized.data,
    })

    await tx.usuario.update({
      where: { id: membro.usuarioId },
      data: {
        etapaOnboarding: 4,
        onboardingCompleto: true,
      },
    })
  })

  if (shouldSendWelcome) {
    queueWelcomeEmail(membro.usuario.nome, membro.usuario.email)
  }

  return {
    success: true,
    message: "Anamnese salva com sucesso!",
  }
}

export async function getMinhaAnamnese(userId: string) {
  const membro = await prisma.membro.findUnique({
    where: { usuarioId: userId },
    include: { anamnese: true },
  })

  if (!membro) {
    throw new OnboardingServiceError(
      "Perfil não encontrado. Complete seu perfil primeiro.",
      "MEMBRO_NOT_FOUND",
      404
    )
  }

  const normalized = normalizeAnamneseRecord(
    extractCanonicalAnamneseData(membro.anamnese)
  )

  if ("error" in normalized) {
    throw new OnboardingServiceError("Dados de anamnese inválidos", "INVALID_ANAMNESE", 500)
  }

  if (membro.anamnese && normalized.changed) {
    await prisma.anamnese.update({
      where: { membroId: membro.id },
      data: normalized.data,
    })
  }

  return {
    sexo: membro.sexo,
    anamnese: membro.anamnese ? normalized.data : null,
  }
}

export async function saveMinhaAnamnese(userId: string, payload: unknown) {
  const membro = await prisma.membro.findUnique({
    where: { usuarioId: userId },
    include: {
      usuario: {
        select: {
          email: true,
          nome: true,
          onboardingCompleto: true,
        },
      },
    },
  })

  if (!membro) {
    throw new OnboardingServiceError(
      "Perfil não encontrado. Complete seu perfil primeiro.",
      "MEMBRO_NOT_FOUND",
      404
    )
  }

  return saveAnamneseForMembro({
    membroId: membro.id,
    usuarioId: userId,
    nome: membro.usuario.nome,
    email: membro.usuario.email,
    onboardingCompleto: membro.usuario.onboardingCompleto,
    payload,
  })
}

export async function createAnamneseLinkForMembro(membroId: string, origin?: string) {
  const membro = await prisma.membro.findUnique({
    where: { id: membroId },
    select: { id: true },
  })

  if (!membro) {
    throw new OnboardingServiceError("Membro não encontrado", "MEMBRO_NOT_FOUND", 404)
  }

  const { token, expiresAt } = await issueAnamneseTokenForMembro(membroId)

  return {
    link: `${getAppBaseUrl(origin)}/anamnese#token=${token}`,
    expiresAt,
  }
}

export async function getHomeRedirectPath(userId: string) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: {
      onboardingCompleto: true,
      membro: {
        select: {
          id: true,
          anamnese: { select: { id: true } },
        },
      },
    },
  })

  if (!usuario) {
    throw new OnboardingServiceError("Usuário não encontrado", "USER_NOT_FOUND", 404)
  }

  if (!usuario.membro) {
    return "/completar-perfil"
  }

  if (!usuario.membro.anamnese) {
    return "/anamnese"
  }

  if (!usuario.onboardingCompleto) {
    return "/anamnese"
  }

  return "/inicio"
}
