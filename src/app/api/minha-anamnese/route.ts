import { NextResponse } from "next/server"
import { withApiAuth } from "@/lib/api"
import {
  getMinhaAnamnese,
  OnboardingServiceError,
  saveMinhaAnamnese,
} from "@/services/onboarding.service"

export async function GET() {
  return withApiAuth(async (session) => {
    try {
      return NextResponse.json(await getMinhaAnamnese(session.user.id))
    } catch (error) {
      if (error instanceof OnboardingServiceError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status }
        )
      }

      console.error("Erro ao buscar anamnese:", error)
      return NextResponse.json(
        { error: "Erro interno ao buscar anamnese" },
        { status: 500 }
      )
    }
  })
}

export async function POST(request: Request) {
  return withApiAuth(async (session) => {
    try {
      let body: unknown
      try {
        body = await request.json()
      } catch {
        return NextResponse.json(
          { error: "Dados inválidos enviados" },
          { status: 400 }
        )
      }

      return NextResponse.json(await saveMinhaAnamnese(session.user.id, body))
    } catch (error) {
      if (error instanceof OnboardingServiceError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status }
        )
      }

      console.error("Erro ao salvar anamnese:", error)
      return NextResponse.json(
        { error: "Erro interno ao salvar anamnese" },
        { status: 500 }
      )
    }
  })
}
