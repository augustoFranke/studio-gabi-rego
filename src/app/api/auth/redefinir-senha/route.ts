import { NextResponse } from "next/server"
import { rateLimitByIp } from "@/lib/rate-limit"
import {
  AccountRecoveryServiceError,
  resetPasswordWithToken,
} from "@/services/account-recovery.service"

export async function POST(request: Request) {
  try {
    const rateLimit = await rateLimitByIp(request, "auth:reset-password")
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em instantes." },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { token, senha } = body

    if (!token || !senha) {
      return NextResponse.json(
        { error: "Token e senha são obrigatórios" },
        { status: 400 }
      )
    }

    const result = await resetPasswordWithToken(token, senha)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AccountRecoveryServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }

    console.error("Erro ao redefinir senha:", error)
    return NextResponse.json(
      { error: "Erro interno ao redefinir senha" },
      { status: 500 }
    )
  }
}
