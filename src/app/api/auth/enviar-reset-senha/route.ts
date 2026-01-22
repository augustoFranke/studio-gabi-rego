import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { enviarEmail, emailTemplates, isResendConfigured } from "@/lib/resend"
import { withApiAuth } from "@/lib/api"

export async function POST(request: Request) {
  return withApiAuth(async (session) => {
    // Only admins can send password reset links for other users
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: "Sem permissão para esta ação" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { usuarioId } = body

    if (!usuarioId) {
      return NextResponse.json(
        { error: "ID do usuário é obrigatório" },
        { status: 400 }
      )
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        nome: true,
        email: true,
      },
    })

    if (!usuario) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      )
    }

    // Generate reset token
    const resetToken = randomBytes(32).toString("hex")
    const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        tokenReset: resetToken,
        tokenResetExpira: tokenExpiry,
      },
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://studiogabirego.com")

    const resetLink = `${baseUrl}/redefinir-senha/${resetToken}`

    if (isResendConfigured()) {
      const result = await enviarEmail({
        para: usuario.email,
        assunto: "Redefinir Senha - Gabi Rêgo Studio",
        html: emailTemplates.redefinirSenha(usuario.nome, resetLink),
      })

      if (!result.success) {
        return NextResponse.json(
          { error: "Erro ao enviar email. Tente novamente." },
          { status: 500 }
        )
      }
    } else {
      console.log("Resend not configured. Reset link:", resetLink)
    }

    return NextResponse.json({
      success: true,
      message: "Link de redefinição de senha enviado!",
    })
  })
}
