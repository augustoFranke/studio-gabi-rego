import { NextResponse } from "next/server"
import { validarEmail } from "@/lib/validators"
import { rateLimitByIp } from "@/lib/rate-limit"
import {
  sanitizeAnamnesePayload,
  type CanonicalAnamneseData,
} from "@/lib/anamnese"
import { PASSWORD_POLICY_MESSAGE } from "@/schemas/password-policy.schema"
import {
  OnboardingServiceError,
  registerUser,
} from "@/services/onboarding.service"

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

    const sanitized =
      hasFullPayload && anamnese
        ? sanitizeAnamnesePayload(anamnese, {
            ignoreUnknownFields: true,
            fillMissingFields: true,
          })
        : null

    if (sanitized && "error" in sanitized) {
      return NextResponse.json(
        { error: sanitized.error },
        { status: 400 }
      )
    }

    const result = await registerUser(
      {
        email: normalizedEmail,
        senha,
        nome: hasFullPayload ? nome.trim() : undefined,
        cpf: cpf ? String(cpf).replace(/\D/g, "") : null,
        rg: rg?.trim() || null,
        telefone: telefone ? String(telefone).replace(/\D/g, "") : null,
        dataNascimento: dataNascimento || null,
        sexo: sexo || null,
        anamnese: sanitized?.data as CanonicalAnamneseData | undefined,
      },
      new URL(request.url).origin
    )

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof OnboardingServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }

    console.error("Erro ao criar conta:", error)
    return NextResponse.json(
      { error: "Erro interno ao criar conta" },
      { status: 500 }
    )
  }
}
