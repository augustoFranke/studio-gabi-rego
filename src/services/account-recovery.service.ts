import { hash } from "bcryptjs"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { enviarEmail, emailTemplates, isResendConfigured } from "@/lib/resend"
import { PASSWORD_POLICY_MESSAGE } from "@/schemas/password-policy.schema"

export class AccountRecoveryServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message)
    this.name = "AccountRecoveryServiceError"
  }
}

function createToken() {
  return randomBytes(32).toString("hex")
}

function createTokenExpiry() {
  return new Date(Date.now() + 60 * 60 * 1000)
}

function getBaseUrl(origin?: string) {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : origin) ||
    "https://studiogabirego.com"
  )
}

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

  const resetToken = createToken()
  const tokenExpiry = createTokenExpiry()

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      tokenReset: resetToken,
      tokenResetExpira: tokenExpiry,
    },
  })

  if (isResendConfigured()) {
    const result = await enviarEmail({
      para: usuario.email,
      assunto: "Redefinir Senha - Studio Gabi Rego",
      html: emailTemplates.redefinirSenha(
        usuario.nome || "Aluno(a)",
        `${getBaseUrl(origin)}/redefinir-senha/${resetToken}`
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

  const usuario = await prisma.usuario.findUnique({
    where: { tokenReset: token },
    select: {
      id: true,
      tokenResetExpira: true,
    },
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

  const usuario = await prisma.usuario.findUnique({
    where: { tokenReset: token },
    select: {
      id: true,
      tokenResetExpira: true,
    },
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

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      senha: senhaHash,
      senhaDefinida: true,
      tokenReset: null,
      tokenResetExpira: null,
    },
  })

  return {
    success: true,
    message: "Senha redefinida com sucesso!",
  }
}
