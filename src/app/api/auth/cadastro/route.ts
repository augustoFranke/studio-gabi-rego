import { NextResponse } from "next/server"
import { validarEmail } from "@/lib/validators"
import { rateLimitByIp, rateLimitByKey } from "@/lib/rate-limit"
import { normalizeMemberProfileInput } from "@/lib/member-profile"
import { sanitizeAnamnesePayload } from "@/lib/anamnese"
import { PASSWORD_POLICY_MESSAGE } from "@/schemas/password-policy.schema"
import {
  OnboardingServiceError,
  registerUser,
} from "@/services/onboarding.service"
import { z } from "zod"
import { logError, safeErrorData } from "@/lib/observability/logger"
import { AUTH_SIGN_UP_FAILED } from "@/lib/observability/events"

const signupSchema = z.object({
  email: z.string().refine((value) => validarEmail(value), {
    message: "Email inválido",
  }),
  senha: z.string().min(1),
  nome: z.string().optional(),
  cpf: z.string().optional().nullable().or(z.literal("")),
  rg: z.string().optional().nullable().or(z.literal("")),
  telefone: z.string().optional().nullable().or(z.literal("")),
  dataNascimento: z.string().optional().nullable().or(z.literal("")),
  sexo: z.string().optional().nullable().or(z.literal("")),
  anamnese: z.record(z.string(), z.string().nullable().optional()).optional(),
})

export async function POST(request: Request) {
  try {
    const rateLimit = await rateLimitByIp(request, "auth:signup", {
      maxRequests: 3,
      windowMs: 60_000,
    })
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em instantes." },
        { status: 429 }
      )
    }

    const validation = signupSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Dados inválidos" },
        { status: 400 }
      )
    }

    const { email, senha, nome, cpf, rg, telefone, dataNascimento, sexo, anamnese } =
      validation.data
    const normalizedSexo =
      sexo === "MASCULINO" ||
      sexo === "FEMININO" ||
      sexo === "" ||
      sexo === null
        ? sexo
        : null
    const normalizedProfile = normalizeMemberProfileInput({
      cpf,
      rg,
      telefone,
      dataNascimento,
      sexo: normalizedSexo,
    })

    if (!email || !validarEmail(email)) {
      return NextResponse.json(
        { error: "Email inválido" },
        { status: 400 }
      )
    }

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
    const emailRateLimit = await rateLimitByKey(request, "auth:signup:email", normalizedEmail, {
      maxRequests: 3,
      windowMs: 10 * 60_000,
    })
    if (!emailRateLimit.success) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em instantes." },
        { status: 429 }
      )
    }

    const hasFullPayload = Boolean(nome && anamnese)
    const sanitized = hasFullPayload
      ? sanitizeAnamnesePayload(anamnese, {
          ignoreUnknownFields: true,
          fillMissingFields: true,
        })
      : null

    if (hasFullPayload) {
      if (!nome || nome.trim().length < 3) {
        return NextResponse.json(
          { error: "Nome deve ter pelo menos 3 caracteres" },
          { status: 400 }
        )
      }

      if (cpf && normalizedProfile.cpf && normalizedProfile.cpf.length !== 11) {
        return NextResponse.json(
          { error: "CPF inválido" },
          { status: 400 }
        )
      }

      if (normalizedProfile.telefoneIsInvalid) {
        return NextResponse.json(
          { error: "Telefone inválido" },
          { status: 400 }
        )
      }

      if (normalizedProfile.dataNascimentoIsInvalid) {
        return NextResponse.json(
          { error: "Data de nascimento inválida" },
          { status: 400 }
        )
      }

      if (normalizedProfile.dataNascimento) {
        const birthDate = normalizedProfile.dataNascimento
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

      if (sanitized && "error" in sanitized) {
        return NextResponse.json(
          { error: sanitized.error },
          { status: 400 }
        )
      }
    }

    const sanitizedAnamnese = sanitized && "error" in sanitized ? undefined : sanitized?.data

    const result = await registerUser(
      {
        email: normalizedEmail,
        senha,
        nome: nome ? nome.trim() : undefined,
        cpf: normalizedProfile.cpf,
        rg: normalizedProfile.rg ?? null,
        telefone: normalizedProfile.telefone,
        dataNascimento: normalizedProfile.dataNascimento?.toISOString() ?? null,
        sexo: normalizedProfile.sexo,
        anamnese: sanitizedAnamnese,
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

    logError(AUTH_SIGN_UP_FAILED, {
      message: 'Erro ao criar conta:',
      ...safeErrorData(error),
    })
    return NextResponse.json(
      { error: "Erro interno ao criar conta" },
      { status: 500 }
    )
  }
}
