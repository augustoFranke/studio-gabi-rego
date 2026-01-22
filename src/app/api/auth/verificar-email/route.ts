import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"

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

    // Check if user is from studio domain - auto-assign as admin
    const isStudioAdmin = usuario.email.endsWith("@studiogabirego.com")

    if (isStudioAdmin) {
      // Auto-admin: skip onboarding entirely
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          emailVerificado: new Date(),
          tokenVerificacao: null,
          tokenVerificacaoExpira: null,
          role: "ADMIN",
          onboardingCompleto: true,
          etapaOnboarding: 4,
        },
      })

      return NextResponse.json({
        success: true,
        message: "Email verificado com sucesso!",
        isAdmin: true,
      })
    }

    // Regular member flow: generate profile completion token
    const profileToken = randomBytes(32).toString("hex")
    const profileTokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Mark email as verified, generate profile token, and advance to next step
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        emailVerificado: new Date(),
        tokenVerificacao: null,
        tokenVerificacaoExpira: null,
        tokenReset: profileToken, // Reuse reset token field for profile completion
        tokenResetExpira: profileTokenExpiry,
        etapaOnboarding: 2, // Move to profile completion step
      },
    })

    return NextResponse.json({
      success: true,
      message: "Email verificado com sucesso!",
      profileToken, // Return token for profile completion
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
