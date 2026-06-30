import { NextResponse } from "next/server"
import { rateLimitByIp, rateLimitByKey } from "@/lib/rate-limit"
import { validateResetToken } from "@/services/account-recovery.service"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")

  const ipRateLimit = await rateLimitByIp(request, "auth:validate-reset-token:ip", {
    maxRequests: 20,
    windowMs: 60_000,
  })
  if (!ipRateLimit.success) {
    return NextResponse.json({ valid: false }, { status: 429 })
  }

  if (token && !/^[a-f0-9]{64}$/i.test(token)) {
    return NextResponse.json({ valid: false })
  }

  const rateLimit = await rateLimitByKey(request, "auth:validate-reset-token", token || "missing")
  if (!rateLimit.success) {
    return NextResponse.json({ valid: false }, { status: 429 })
  }

  return NextResponse.json(await validateResetToken(token || ""))
}
