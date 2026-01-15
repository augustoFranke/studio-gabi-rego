import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { enviarEmail, emailTemplates, isResendConfigured } from "@/lib/resend"
import { validarEmail } from "@/lib/validators"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email || !validarEmail(email)) {
      return NextResponse.json(
        { error: "Email inválido" },
        { status: 400 }
      )
    }

    // Find user
    const usuario = await prisma.usuario.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!usuario) {
      // Don't reveal if email exists or not for security
      return NextResponse.json({
        success: true,
        message: "Se o email existir, um novo link será enviado.",
      })
    }

    // Check if already verified
    if (usuario.emailVerificado) {
      return NextResponse.json(
        { error: "Este email já foi verificado. Faça login." },
        { status: 400 }
      )
    }

    // Generate new token
    const verificationToken = randomBytes(32).toString("hex")
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        tokenVerificacao: verificationToken,
        tokenVerificacaoExpira: tokenExpiry,
      },
    })

    // Send verification email
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000"

    const verificationLink = `${baseUrl}/verificar-email/${verificationToken}`

    if (isResendConfigured()) {
      await enviarEmail({
        para: email,
        assunto: "Verifique seu email - Gabi Studio",
        html: emailTemplates.verificacaoEmail(usuario.nome, verificationLink),
      })
    } else {
      console.log("Resend not configured. Verification link:", verificationLink)
    }

    return NextResponse.json({
      success: true,
      message: "Email de verificação reenviado!",
    })
  } catch (error) {
    console.error("Erro ao reenviar verificação:", error)
    return NextResponse.json(
      { error: "Erro interno ao reenviar verificação" },
      { status: 500 }
    )
  }
}
