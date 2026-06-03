import { NextResponse } from "next/server"
import { rateLimitByKey } from "@/lib/rate-limit"
import { validateResetToken } from "@/services/account-recovery.service"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")

  const rateLimit = await rateLimitByKey(request, "auth:validate-reset-token", token || "missing")
  if (!rateLimit.success) {
    return NextResponse.json({ valid: false }, { status: 429 })
  }

  return NextResponse.json(await validateResetToken(token || ""))
}
