import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { enviarEmail, emailTemplates, isResendConfigured } from "@/lib/resend"
import { validarEmail } from "@/lib/validators"
import { rateLimitByIp } from "@/lib/rate-limit"
import { sanitizeAnamnesePayload } from "@/lib/anamnese"
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
    const { email, senha, nome, cpf, rg, telefone, dataNascimento, sexo, anamnese } = body

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
        { error: PASSWORD_POLICY_MESSAGE },
        { status: 400 }
      )
    }

    if (!/[A-Z]/.test(senha)) {
      return NextResponse.json(
        { error: PASSWORD_POLICY_MESSAGE },
        { status: 400 }
      )
    }

    if (!/[0-9]/.test(senha)) {
      return NextResponse.json(
        { error: PASSWORD_POLICY_MESSAGE },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()
    const hasFullPayload = Boolean(nome && anamnese)

    // Validate profile fields when full payload is provided
    if (hasFullPayload) {
      if (typeof nome !== "string" || nome.trim().length < 3) {
        return NextResponse.json(
          { error: "Nome deve ter pelo menos 3 caracteres" },
          { status: 400 }
        )
      }

      if (cpf) {
        const cpfNumbers = String(cpf).replace(/\D/g, "")
        if (cpfNumbers.length !== 11) {
          return NextResponse.json(
            { error: "CPF inválido" },
            { status: 400 }
          )
        }
      }

      if (telefone) {
        const telefoneNumbers = String(telefone).replace(/\D/g, "")
        if (telefoneNumbers.length < 10) {
          return NextResponse.json(
            { error: "Telefone inválido" },
            { status: 400 }
          )
        }
      }

      if (dataNascimento) {
        const birthDate = new Date(dataNascimento)
        if (Number.isNaN(birthDate.getTime())) {
          return NextResponse.json(
            { error: "Data de nascimento inválida" },
            { status: 400 }
          )
        }
        const today = new Date()
        let age = today.getFullYear() - birthDate.getFullYear()
        const monthDiff = today.getMonth() - birthDate.getMonth()
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--
        }
        if (age < 16) {
          return NextResponse.json(
            { error: "Você precisa ter pelo menos 16 anos" },
            { status: 400 }
          )
        }
      }

      if (sexo && sexo !== "MASCULINO" && sexo !== "FEMININO") {
        return NextResponse.json(
          { error: "Sexo inválido" },
          { status: 400 }
        )
      }

      // Validate anamnesis data
      const anamneseResult = sanitizeAnamnesePayload(anamnese, {
        ignoreUnknownFields: true,
        fillMissingFields: true,
      })
      if ("error" in anamneseResult) {
        return NextResponse.json(
          { error: anamneseResult.error },
          { status: 400 }
        )
      }
    }

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

      // Verified user without membro - unlikely with the new flow but handle gracefully
      return NextResponse.json({
        success: true,
        message: "Se o email existir, enviaremos instruções.",
      })
    }

    // Generate verification token (needed for both paths)
    const verificationToken = randomBytes(32).toString("hex")
    const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    if (hasFullPayload) {
      // FULL REGISTRATION: Create/update user + membro + anamnese atomically
      const sanitized = sanitizeAnamnesePayload(anamnese, {
        ignoreUnknownFields: true,
        fillMissingFields: true,
      })
      if ("error" in sanitized) {
        return NextResponse.json(
          { error: sanitized.error },
          { status: 400 }
        )
      }

      const cpfNumbers = cpf ? String(cpf).replace(/\D/g, "") : null
      const telefoneNumbers = telefone ? String(telefone).replace(/\D/g, "") : null
      const parsedDate = dataNascimento ? new Date(dataNascimento) : null

      await prisma.$transaction(async (tx) => {
        let userId: string

        if (existingUser) {
          // Update existing unverified user
          await tx.usuario.update({
            where: { id: existingUser.id },
            data: {
              nome: nome.trim(),
              senha: hashedPassword,
              senhaDefinida: true,
              tokenVerificacao: verificationToken,
              tokenVerificacaoExpira: tokenExpiry,
              etapaOnboarding: 1,
              onboardingCompleto: false,
            },
          })
          userId = existingUser.id
        } else {
          // Create new user
          const newUser = await tx.usuario.create({
            data: {
              email: normalizedEmail,
              nome: nome.trim(),
              senha: hashedPassword,
              senhaDefinida: true,
              role: "MEMBRO",
              tokenVerificacao: verificationToken,
              tokenVerificacaoExpira: tokenExpiry,
              etapaOnboarding: 1,
              onboardingCompleto: false,
            },
          })
          userId = newUser.id
        }

        // Create membro (upsert-like: delete existing if any for zombie users)
        const existingMembro = await tx.membro.findUnique({
          where: { usuarioId: userId },
        })
        if (existingMembro) {
          // Delete existing membro (cascade deletes anamnese too)
          await tx.membro.delete({ where: { id: existingMembro.id } })
        }

        const membro = await tx.membro.create({
          data: {
            usuarioId: userId,
            cpf: cpfNumbers || null,
            rg: rg?.trim() || null,
            telefone: telefoneNumbers || null,
            dataNascimento: parsedDate,
            sexo: sexo || null,
            status: "PENDENTE",
          },
        })

        await tx.anamnese.create({
          data: {
            membroId: membro.id,
            ...sanitized.data,
          },
        })
      })
    } else {
      // LEGACY/SIMPLE REGISTRATION: Only email + password
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
      html: emailTemplates.verificacaoEmail(hasFullPayload ? nome.trim() : null, verificationLink),
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
