import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { enviarEmail, emailTemplates, isResendConfigured } from "@/lib/resend"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json(
        { error: "Token não fornecido" },
        { status: 400 }
      )
    }

    // Find user with this token
    const usuario = await prisma.usuario.findUnique({
      where: { tokenVerificacao: token },
      include: { membro: { select: { id: true } } },
    })

    if (!usuario) {
      return NextResponse.json(
        { error: "Token inválido" },
        { status: 400 }
      )
    }

    // Check if token expired
    if (usuario.tokenVerificacaoExpira && usuario.tokenVerificacaoExpira < new Date()) {
      return NextResponse.json(
        { error: "Token expirado" },
        { status: 400 }
      )
    }

    // Mark email as verified and complete onboarding
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

    // Send welcome email (fire-and-forget)
    if (isResendConfigured() && usuario.nome) {
      enviarEmail({
        para: usuario.email,
        assunto: "Bem-vindo(a) ao Gabi Studio!",
        html: emailTemplates.boasVindas(usuario.nome),
      }).catch((err) => console.error("Failed to send welcome email:", err))
    }

    return NextResponse.json({
      success: true,
      message: "Email verificado com sucesso!",
      isAdmin: false,
    })
  } catch (error) {
    console.error("Erro ao verificar email:", error)
    return NextResponse.json(
      { error: "Erro interno ao verificar email" },
      { status: 500 }
    )
  }
}
