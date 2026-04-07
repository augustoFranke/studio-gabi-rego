import { NextResponse } from "next/server"
import {
  OnboardingServiceError,
  verifyEmailToken,
} from "@/services/onboarding.service"

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

    const result = await verifyEmailToken(token, new URL(request.url).origin)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof OnboardingServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }

    console.error("Erro ao verificar email:", error)
    return NextResponse.json(
      { error: "Erro interno ao verificar email" },
      { status: 500 }
    )
  }
}
