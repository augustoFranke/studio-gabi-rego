import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { enviarEmail, emailTemplates, isResendConfigured } from "@/lib/resend"
import { PASSWORD_POLICY_MESSAGE } from "@/schemas/password-policy.schema"
import { createTimedToken, getAppBaseUrl, getTimedTokenLookup, hashTimedToken } from "@/lib/auth-flow"

import { ServiceError as AccountRecoveryServiceError } from './errors'
export { ServiceError as AccountRecoveryServiceError } from './errors'

function validatePasswordOrThrow(password: string) {
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new AccountRecoveryServiceError(
      PASSWORD_POLICY_MESSAGE,
      "INVALID_PASSWORD",
      400
    )
  }
}

export async function issuePasswordResetLink(usuarioId: string, origin?: string) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      nome: true,
      email: true,
    },
  })

  if (!usuario) {
    throw new AccountRecoveryServiceError("Usuário não encontrado", "USER_NOT_FOUND", 404)
  }

  if (!usuario.email) {
    throw new AccountRecoveryServiceError(
      "Usuário sem email cadastrado",
      "USER_WITHOUT_EMAIL",
      400
    )
  }

  const { token: resetToken, expiresAt: tokenExpiry } = createTimedToken()

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      tokenReset: await hashTimedToken(resetToken),
      tokenResetExpira: tokenExpiry,
    },
  })

  if (isResendConfigured()) {
    const result = await enviarEmail({
      para: usuario.email,
      assunto: "Redefinir Senha - Studio Gabi Rego",
      html: emailTemplates.redefinirSenha(
        usuario.nome || "Aluno(a)",
        `${getAppBaseUrl(origin)}/redefinir-senha/${resetToken}`
      ),
    })

    if (!result.success) {
      throw new AccountRecoveryServiceError(
        "Erro ao enviar email. Tente novamente.",
        "RESET_EMAIL_FAILED",
        500
      )
    }
  } else {
    console.warn("Resend não configurado - envio de email ignorado.")
  }

  return {
    success: true,
    message: "Link de redefinição de senha enviado!",
  }
}

export async function validateResetToken(token: string) {
  if (!token) {
    return { valid: false }
  }

  const { rawToken, hashedToken } = await getTimedTokenLookup(token)
  const usuarioQuery = {
    where: { tokenReset: { in: [hashedToken, rawToken] } },
    select: {
      id: true,
      tokenResetExpira: true,
    },
  }
  const usuario = typeof prisma.usuario.findFirst === 'function'
    ? await prisma.usuario.findFirst(usuarioQuery)
    : await prisma.usuario.findUnique({
        where: { tokenReset: rawToken },
        select: usuarioQuery.select,
      })

  if (!usuario) {
    return { valid: false }
  }

  if (!usuario.tokenResetExpira || usuario.tokenResetExpira < new Date()) {
    return { valid: false }
  }

  return { valid: true }
}

export async function resetPasswordWithToken(token: string, senha: string) {
  if (!token || !senha) {
    throw new AccountRecoveryServiceError(
      "Token e senha são obrigatórios",
      "MISSING_FIELDS",
      400
    )
  }

  validatePasswordOrThrow(senha)

  const { rawToken, hashedToken } = await getTimedTokenLookup(token)
  const usuarioQuery = {
    where: { tokenReset: { in: [hashedToken, rawToken] } },
    select: {
      id: true,
      tokenResetExpira: true,
    },
  }
  const usuario = typeof prisma.usuario.findFirst === 'function'
    ? await prisma.usuario.findFirst(usuarioQuery)
    : await prisma.usuario.findUnique({
        where: { tokenReset: rawToken },
        select: usuarioQuery.select,
      })

  if (!usuario) {
    throw new AccountRecoveryServiceError(
      "Token inválido ou expirado",
      "INVALID_RESET_TOKEN",
      400
    )
  }

  if (!usuario.tokenResetExpira || usuario.tokenResetExpira < new Date()) {
    throw new AccountRecoveryServiceError(
      "Este link expirou. Solicite um novo link de redefinição.",
      "EXPIRED_RESET_TOKEN",
      400
    )
  }

  const senhaHash = await hash(senha, 12)

  const result = await prisma.usuario.updateMany({
    where: {
      id: usuario.id,
      tokenReset: { in: [hashedToken, rawToken] },
      tokenResetExpira: { gt: new Date() },
    },
    data: {
      senha: senhaHash,
      senhaDefinida: true,
      tokenReset: null,
      tokenResetExpira: null,
    },
  })

  if (result.count !== 1) {
    throw new AccountRecoveryServiceError(
      "Token inválido ou expirado",
      "INVALID_RESET_TOKEN",
      400
    )
  }

  return {
    success: true,
    message: "Senha redefinida com sucesso!",
  }
}
