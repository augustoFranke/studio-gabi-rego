import { NextRequest, NextResponse } from "next/server"
import { withApiAuth } from "@/lib/api"
import { getAppBaseUrl } from "@/lib/auth-flow"
import { createPerfilTokenForMembro } from "@/services/perfil.service"
import { logError, safeErrorData } from "@/lib/observability/logger"
import { MEMBRO_PROFILE_LINK_FAILED } from "@/lib/observability/events"

interface Params {
  params: Promise<{
    id: string
  }>
}

export async function POST(
  request: NextRequest,
  { params }: Params
) {
  return withApiAuth(async () => {
    try {
      const { id } = await params
      const result = await createPerfilTokenForMembro(id)

      if (!result) {
        return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 })
      }

      const baseUrl = getAppBaseUrl(request.nextUrl.origin)
      const link = `${baseUrl}/completar-perfil?token=${result.token}`

      return NextResponse.json({ link, expiresAt: result.tokenExpiry })
    } catch (error) {
      logError(MEMBRO_PROFILE_LINK_FAILED, {
        message: 'Erro ao gerar link de perfil:',
        ...safeErrorData(error),
      })
      return NextResponse.json(
        { error: "Erro interno ao gerar link" },
        { status: 500 }
      )
    }
  }, { requiredRole: "ADMIN" })
}
