import { NextResponse } from "next/server"
import { validarEmail } from "@/lib/validators"
import { rateLimitByIp } from "@/lib/rate-limit"
import {
  OnboardingServiceError,
  resendVerificationEmail,
} from "@/services/onboarding.service"

export async function POST(request: Request) {
  try {
    const rateLimit = await rateLimitByIp(request, "auth:resend-verification")
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em instantes." },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { email } = body

    if (!email || !validarEmail(email)) {
      return NextResponse.json(
        { error: "Email inválido" },
        { status: 400 }
      )
    }

    const result = await resendVerificationEmail(
      email,
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

    console.error("Erro ao reenviar verificação:", error)
    return NextResponse.json(
      { error: "Erro interno ao reenviar verificação" },
      { status: 500 }
    )
  }
}
