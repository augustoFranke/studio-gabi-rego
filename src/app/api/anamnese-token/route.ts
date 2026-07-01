import { NextRequest, NextResponse } from "next/server"
import {
  getAnamneseByToken,
  OnboardingServiceError,
  saveAnamneseByToken,
} from "@/services/onboarding.service"
import { isTimedTokenFormat } from "@/lib/auth-flow"
import { rateLimitByIp, rateLimitByKey } from "@/lib/rate-limit"
import { logError, safeErrorData } from "@/lib/observability/logger"
import { ANAMNESE_TOKEN_FETCH_FAILED, ANAMNESE_TOKEN_SAVE_FAILED } from "@/lib/observability/events"

function getTokenFromRequest(request: NextRequest) {
  const tokenFromHeader = request.headers.get("x-anamnese-token")?.trim() || null

  if (tokenFromHeader) {
    return { token: tokenFromHeader, source: "header" as const }
  }
  return { token: null, source: null }
}

export async function GET(request: NextRequest) {
  try {
    const { token, source } = getTokenFromRequest(request)

    if (!token) {
      return NextResponse.json({ error: "Token não fornecido" }, { status: 400 })
    }

    if (!isTimedTokenFormat(token)) {
      return NextResponse.json({ error: "Token inválido" }, { status: 400 })
    }

    const ipLimit = await rateLimitByIp(request, "onboarding:anamnese-token:ip", {
      maxRequests: 30,
      windowMs: 60_000,
    })
    if (!ipLimit.success) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em instantes." },
        { status: 429 }
      )
    }

    const rateLimit = await rateLimitByKey(request, "onboarding:anamnese-token:get", token)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em instantes." },
        { status: 429 }
      )
    }

    void source
    return NextResponse.json(await getAnamneseByToken(token))
  } catch (error) {
    if (error instanceof OnboardingServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }

    logError(ANAMNESE_TOKEN_FETCH_FAILED, {
      message: 'Erro ao buscar anamnese por token:',
      ...safeErrorData(error),
    })
    return NextResponse.json(
      { error: "Erro interno ao buscar anamnese" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { token } = getTokenFromRequest(request)

    if (!token) {
      return NextResponse.json({ error: "Token não fornecido" }, { status: 400 })
    }

    if (!isTimedTokenFormat(token)) {
      return NextResponse.json({ error: "Token inválido" }, { status: 400 })
    }

    const ipLimit = await rateLimitByIp(request, "onboarding:anamnese-token:ip", {
      maxRequests: 30,
      windowMs: 60_000,
    })
    if (!ipLimit.success) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em instantes." },
        { status: 429 }
      )
    }

    const rateLimit = await rateLimitByKey(request, "onboarding:anamnese-token:post", token)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em instantes." },
        { status: 429 }
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Dados inválidos enviados" }, { status: 400 })
    }

    return NextResponse.json(await saveAnamneseByToken(token, body))
  } catch (error) {
    if (error instanceof OnboardingServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }

    logError(ANAMNESE_TOKEN_SAVE_FAILED, {
      message: 'Erro ao salvar anamnese por token:',
      ...safeErrorData(error),
    })
    return NextResponse.json(
      { error: "Erro interno ao salvar anamnese" },
      { status: 500 }
    )
  }
}
