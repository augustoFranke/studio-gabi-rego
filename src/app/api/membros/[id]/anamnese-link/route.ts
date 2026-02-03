import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { withApiAuth } from "@/lib/api"

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
      const membro = await prisma.membro.findUnique({
        where: { id },
        select: { id: true },
      })

      if (!membro) {
        return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 })
      }

      const token = randomBytes(32).toString("hex")
      const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000)

      await prisma.membro.update({
        where: { id },
        data: {
          anamneseToken: token,
          anamneseTokenExpira: tokenExpiry,
        },
      })

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
      const link = `${baseUrl}/anamnese?token=${token}`

      return NextResponse.json({ link, expiresAt: tokenExpiry })
    } catch (error) {
      console.error("Erro ao gerar link de anamnese:", error)
      return NextResponse.json(
        { error: "Erro interno ao gerar link" },
        { status: 500 }
      )
    }
  }, { requiredRole: "ADMIN" })
}
