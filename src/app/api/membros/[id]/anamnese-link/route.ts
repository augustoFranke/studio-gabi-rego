import { NextRequest, NextResponse } from "next/server"
import { withApiAuth } from "@/lib/api"
import {
  createAnamneseLinkForMembro,
  OnboardingServiceError,
} from "@/services/onboarding.service"
import { logError, safeErrorData } from "@/lib/observability/logger"
import { MEMBRO_ANAMNESE_LINK_FAILED } from "@/lib/observability/events"

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
      return NextResponse.json(
        await createAnamneseLinkForMembro(id, request.nextUrl.origin)
      )
    } catch (error) {
      if (error instanceof OnboardingServiceError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status }
        )
      }

      logError(MEMBRO_ANAMNESE_LINK_FAILED, {
        message: 'Erro ao gerar link de anamnese:',
        ...safeErrorData(error),
      })
      return NextResponse.json(
        { error: "Erro interno ao gerar link" },
        { status: 500 }
      )
    }
  }, { requiredRole: "ADMIN" })
}
