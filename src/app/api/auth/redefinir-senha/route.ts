import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { rateLimitByIp } from "@/lib/rate-limit"

export async function POST(request: Request) {
  try {
    const rateLimit = await rateLimitByIp(request, "auth:reset-password")
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em instantes." },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { token, senha } = body

    if (!token || !senha) {
      return NextResponse.json(
        { error: "Token e senha são obrigatórios" },
        { status: 400 }
      )
    }

    // Validate password requirements
    if (senha.length < 8) {
      return NextResponse.json(
        { error: "A senha deve ter no mínimo 8 caracteres" },
        { status: 400 }
      )
    }

    if (!/[A-Z]/.test(senha)) {
      return NextResponse.json(
        { error: "A senha deve conter pelo menos uma letra maiúscula" },
        { status: 400 }
      )
    }

    if (!/[0-9]/.test(senha)) {
      return NextResponse.json(
        { error: "A senha deve conter pelo menos um número" },
        { status: 400 }
      )
    }

    // Find user by token
    const usuario = await prisma.usuario.findUnique({
      where: { tokenReset: token },
      select: {
        id: true,
        tokenResetExpira: true,
      },
    })

    if (!usuario) {
      return NextResponse.json(
        { error: "Token inválido ou expirado" },
        { status: 400 }
      )
    }

    // Check if token has expired
    if (!usuario.tokenResetExpira || usuario.tokenResetExpira < new Date()) {
      return NextResponse.json(
        { error: "Este link expirou. Solicite um novo link de redefinição." },
        { status: 400 }
      )
    }

    // Hash new password and update user
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

    return NextResponse.json({
      success: true,
      message: "Senha redefinida com sucesso!",
    })
  } catch (error) {
    console.error("Erro ao redefinir senha:", error)
    return NextResponse.json(
      { error: "Erro interno ao redefinir senha" },
      { status: 500 }
    )
  }
}
