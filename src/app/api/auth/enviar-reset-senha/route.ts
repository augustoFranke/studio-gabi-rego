import { NextResponse } from "next/server"
import { withApiAuth } from "@/lib/api"
import { rateLimitByIp } from "@/lib/rate-limit"
import {
  AccountRecoveryServiceError,
  issuePasswordResetLink,
} from "@/services/account-recovery.service"

export async function POST(request: Request) {
  return withApiAuth(async (session) => {
    try {
      const rateLimit = await rateLimitByIp(request, "auth:admin-reset")
      if (!rateLimit.success) {
        return NextResponse.json(
          { error: "Muitas tentativas. Tente novamente em instantes." },
          { status: 429 }
        )
      }

      if (session.user.role !== 'ADMIN') {
        return NextResponse.json(
          { error: "Sem permissão para esta ação" },
          { status: 403 }
        )
      }

      const body = await request.json()
      const { usuarioId } = body

      if (!usuarioId) {
        return NextResponse.json(
          { error: "ID do usuário é obrigatório" },
          { status: 400 }
        )
      }

      const result = await issuePasswordResetLink(
        usuarioId,
        new URL(request.url).origin
      )

      return NextResponse.json(result)
    } catch (error) {
      if (error instanceof AccountRecoveryServiceError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status }
        )
      }

      throw error
    }
  })
}
