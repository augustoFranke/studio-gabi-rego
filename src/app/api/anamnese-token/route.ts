import { NextRequest, NextResponse } from "next/server"
import {
  getAnamneseByToken,
  OnboardingServiceError,
  saveAnamneseByToken,
} from "@/services/onboarding.service"

const TOKEN_COOKIE_NAME = "anamnese_token"
const isProduction = process.env.NODE_ENV === "production"

function getTokenFromRequest(request: NextRequest) {
  const tokenFromHeader = request.headers.get("x-anamnese-token")?.trim() || null
  const tokenFromQuery = request.nextUrl.searchParams.get("token")
  const tokenFromCookie = request.cookies.get(TOKEN_COOKIE_NAME)?.value || null

  if (tokenFromHeader) {
    return { token: tokenFromHeader, source: "header" as const }
  }
  if (tokenFromQuery) {
    return { token: tokenFromQuery, source: "query" as const }
  }
  if (tokenFromCookie) {
    return { token: tokenFromCookie, source: "cookie" as const }
  }
  return { token: null, source: null }
}

function setTokenCookie(response: NextResponse, token: string) {
  response.cookies.set(TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/anamnese",
    maxAge: 60 * 60,
  })
}

function clearTokenCookie(response: NextResponse) {
  response.cookies.set(TOKEN_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/anamnese",
    maxAge: 0,
  })
}

export async function GET(request: NextRequest) {
  try {
    const { token, source } = getTokenFromRequest(request)

    if (!token) {
      return NextResponse.json({ error: "Token não fornecido" }, { status: 400 })
    }

    const response = NextResponse.json(await getAnamneseByToken(token))

    if (source && source !== "cookie") {
      setTokenCookie(response, token)
    }

    return response
  } catch (error) {
    if (error instanceof OnboardingServiceError) {
      const { source } = getTokenFromRequest(request)
      const response = NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
      if (source === "cookie" && error.status === 404) {
        clearTokenCookie(response)
      }
      return response
    }

    console.error("Erro ao buscar anamnese por token:", error)
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

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Dados inválidos enviados" }, { status: 400 })
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: "Dados inválidos enviados" }, { status: 400 })
    }
    const response = NextResponse.json(
      await saveAnamneseByToken(token, body as Record<string, unknown>)
    )

    clearTokenCookie(response)

    return response
  } catch (error) {
    if (error instanceof OnboardingServiceError) {
      const { source } = getTokenFromRequest(request)
      const response = NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
      if (source === "cookie" && error.status === 404) {
        clearTokenCookie(response)
      }
      return response
    }

    console.error("Erro ao salvar anamnese por token:", error)
    return NextResponse.json(
      { error: "Erro interno ao salvar anamnese" },
      { status: 500 }
    )
  }
}
