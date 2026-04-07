import { NextResponse } from "next/server"
import { validateResetToken } from "@/services/account-recovery.service"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    return NextResponse.json(await validateResetToken(token || ""))
  } catch (error) {
    console.error("Erro ao validar token:", error)
    return NextResponse.json({ valid: false })
  }
}
