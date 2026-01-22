import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ valid: false })
    }

    const usuario = await prisma.usuario.findUnique({
      where: { tokenReset: token },
      select: {
        id: true,
        tokenResetExpira: true,
      },
    })

    if (!usuario) {
      return NextResponse.json({ valid: false })
    }

    // Check if token has expired
    if (!usuario.tokenResetExpira || usuario.tokenResetExpira < new Date()) {
      return NextResponse.json({ valid: false })
    }

    return NextResponse.json({ valid: true })
  } catch (error) {
    console.error("Erro ao validar token:", error)
    return NextResponse.json({ valid: false })
  }
}
