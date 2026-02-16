import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { enviarEmail, emailTemplates, isResendConfigured } from "@/lib/resend"
import { rateLimitByIp } from "@/lib/rate-limit"
import { cadastroSchema } from "@/schemas/auth.schema"
import { PASSWORD_POLICY_MESSAGE } from "@/schemas/password-policy.schema"

export async function POST(request: Request) {
  try {
    const rateLimit = await rateLimitByIp(request, "auth:signup")
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em instantes." },
        { status: 429 }
      )
    }

    const body = await request.json()
    const parsed = cadastroSchema.safeParse(body)
    if (!parsed.success) {
      const hasEmailIssue = parsed.error.issues.some((issue) => issue.path[0] === "email")
      return NextResponse.json(
        { error: hasEmailIssue ? "Email inválido" : PASSWORD_POLICY_MESSAGE },
        { status: 400 }
      )
    }

    const { email, senha } = parsed.data

    const normalizedEmail = email.toLowerCase().trim()

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://studiogabirego.com")

    // Parallelize user lookup and password hashing (hash takes ~100-300ms)
    const [existingUser, hashedPassword] = await Promise.all([
      prisma.usuario.findUnique({
        where: { email: normalizedEmail },
        select: {
          id: true,
          nome: true,
          emailVerificado: true,
          onboardingCompleto: true,
          membro: { select: { id: true } },
        },
      }),
      hash(senha, 12),
    ])

    if (existingUser?.emailVerificado) {
      if (existingUser.membro || existingUser.onboardingCompleto) {
        return NextResponse.json({
          success: true,
          message: "Se o email existir, enviaremos instruções.",
        })
      }

      const profileToken = randomBytes(32).toString("hex")
      const profileTokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await prisma.usuario.update({
        where: { id: existingUser.id },
        data: {
          tokenReset: profileToken,
          tokenResetExpira: profileTokenExpiry,
          etapaOnboarding: 2,
          onboardingCompleto: false,
        },
      })

      const completionLink = `${baseUrl}/completar-perfil?token=${profileToken}`

      if (isResendConfigured()) {
        const emailResult = await enviarEmail({
          para: normalizedEmail,
          assunto: "Complete seu cadastro - Gabi Studio",
          html: emailTemplates.completarPerfil(existingUser.nome ?? null, completionLink),
        })

        if (!emailResult.success) {
          console.error("Failed to send profile completion email:", emailResult.error)
          return NextResponse.json(
            { error: "Não foi possível enviar o email agora. Tente novamente." },
            { status: 500 }
          )
        }
      } else {
        console.warn("Resend not configured - skipping email send")
        return NextResponse.json(
          { error: "Serviço de email não configurado. Contate o suporte." },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: "Se o email existir, enviaremos instruções.",
      })
    }

    // Generate verification token (needed for both paths)
    const verificationToken = randomBytes(32).toString("hex")
    const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    if (existingUser) {
      // UNVERIFIED (ZOMBIE) USER: Update and resend
      await prisma.usuario.update({
        where: { id: existingUser.id },
        data: {
          senha: hashedPassword,
          senhaDefinida: true,
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
          email: normalizedEmail,
          senha: hashedPassword,
          senhaDefinida: true,
          role: "MEMBRO",
          tokenVerificacao: verificationToken,
          tokenVerificacaoExpira: tokenExpiry,
          etapaOnboarding: 1,
          onboardingCompleto: false,
        },
      })
    }

    // Send verification email
    const verificationLink = `${baseUrl}/verificar-email/${verificationToken}`

    if (!isResendConfigured()) {
      console.warn("Resend not configured - skipping email send")
      return NextResponse.json(
        { error: "Serviço de email não configurado. Contate o suporte." },
        { status: 500 }
      )
    }

    const emailResult = await enviarEmail({
      para: normalizedEmail,
      assunto: "Verifique seu email - Gabi Studio",
      html: emailTemplates.verificacaoEmail(null, verificationLink),
    })

    if (!emailResult.success) {
      console.error("Failed to send verification email:", emailResult.error)
      return NextResponse.json(
        { error: "Não foi possível enviar o email agora. Tente novamente." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Se o email existir, enviaremos instruções.",
    })
  } catch (error) {
    console.error("Erro ao criar conta:", error)
    return NextResponse.json(
      { error: "Erro interno ao criar conta" },
      { status: 500 }
    )
  }
}
