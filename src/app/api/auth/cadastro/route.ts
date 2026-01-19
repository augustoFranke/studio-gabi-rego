import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { enviarEmail, emailTemplates, isResendConfigured } from "@/lib/resend"
import { validarEmail } from "@/lib/validators"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, senha } = body

    // Validate email format
    if (!email || !validarEmail(email)) {
      return NextResponse.json(
        { error: "Email inválido" },
        { status: 400 }
      )
    }

    // Validate password
    if (!senha || senha.length < 8) {
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

    // Check if email already exists
    const existingUser = await prisma.usuario.findUnique({
      where: { email: email.toLowerCase() },
    })

    // Generate verification token (needed for both paths)
    const verificationToken = randomBytes(32).toString("hex")
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Hash password (needed for both paths)
    const hashedPassword = await hash(senha, 12)

    if (existingUser) {
      // VERIFIED USER: Block registration
      if (existingUser.emailVerificado) {
        return NextResponse.json(
          { error: "Este email já está cadastrado" },
          { status: 400 }
        )
      }

      // UNVERIFIED (ZOMBIE) USER: Update and resend
      await prisma.usuario.update({
        where: { id: existingUser.id },
        data: {
          senha: hashedPassword,
          tokenVerificacao: verificationToken,
          tokenVerificacaoExpira: tokenExpiry,
          etapaOnboarding: 1,
          onboardingCompleto: false,
        },
      })
    } else {
      // NEW USER: Create account
      await prisma.usuario.create({
        data: {
          email: email.toLowerCase(),
          senha: hashedPassword,
          role: "MEMBRO",
          tokenVerificacao: verificationToken,
          tokenVerificacaoExpira: tokenExpiry,
          etapaOnboarding: 1,
          onboardingCompleto: false,
        },
      })
    }

    // Send verification email
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

    const verificationLink = `${baseUrl}/verificar-email/${verificationToken}`

    console.log("Resend configured:", isResendConfigured())
    console.log("Base URL:", baseUrl)
    console.log("Verification link:", verificationLink)

    if (isResendConfigured()) {
      const emailResult = await enviarEmail({
        para: email,
        assunto: "Verifique seu email - Gabi Studio",
        html: emailTemplates.verificacaoEmail(null, verificationLink),
      })

      if (!emailResult.success) {
        console.error("Failed to send verification email:", emailResult.error)
        return NextResponse.json(
          { error: "Falha ao enviar email de verificação. Tente novamente." },
          { status: 500 }
        )
      }

      console.log("Verification email sent successfully:", emailResult.id)
    } else {
      console.warn("Resend not configured - skipping email send")
      // In production, this should probably return an error instead of success
      return NextResponse.json(
        { error: "Serviço de email não configurado. Contate o suporte." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Conta criada com sucesso! Verifique seu email.",
    })
  } catch (error) {
    console.error("Erro ao criar conta:", error)
    return NextResponse.json(
      { error: "Erro interno ao criar conta" },
      { status: 500 }
    )
  }
}
