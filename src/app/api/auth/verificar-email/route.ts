import { NextResponse } from "next/server"
import { isTimedTokenFormat } from "@/lib/auth-flow"
import { rateLimitByIp, rateLimitByKey } from "@/lib/rate-limit"
import {
  OnboardingServiceError,
  verifyEmailToken,
} from "@/services/onboarding.service"
import { z } from "zod"
import { logError, safeErrorData } from "@/lib/observability/logger"
import { AUTH_VERIFICATION_FAILED } from "@/lib/observability/events"

const verifyEmailSchema = z.object({
  token: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    const validation = verifyEmailSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json(
        { error: "Token não fornecido" },
        { status: 400 }
      )
    }

    const ipLimit = await rateLimitByIp(request, "auth:verify-email:ip", {
      maxRequests: 30,
      windowMs: 60_000,
    })
    if (!ipLimit.success) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em instantes." },
        { status: 429 }
      )
    }

    if (!isTimedTokenFormat(validation.data.token)) {
      return NextResponse.json(
        { error: "Token inválido" },
        { status: 400 }
      )
    }

    const rateLimit = await rateLimitByKey(request, "auth:verify-email", validation.data.token)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em instantes." },
        { status: 429 }
      )
    }

    const result = await verifyEmailToken(validation.data.token, new URL(request.url).origin)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof OnboardingServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }

    logError(AUTH_VERIFICATION_FAILED, {
      message: 'Erro ao verificar email:',
      ...safeErrorData(error),
    })
    return NextResponse.json(
      { error: "Erro interno ao verificar email" },
      { status: 500 }
    )
  }
}
