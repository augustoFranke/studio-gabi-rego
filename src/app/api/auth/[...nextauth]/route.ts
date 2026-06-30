import { NextRequest, NextResponse } from "next/server"
import { handlers } from "@/lib/auth"
import { rateLimitByIp, rateLimitByKey } from "@/lib/rate-limit"

export const runtime = 'nodejs'

export const GET = handlers.GET

export async function POST(request: NextRequest) {
  const url = new URL(request.url)

  if (url.pathname.includes("/callback/credentials")) {
    const rateLimit = await rateLimitByIp(request, "auth:login:ip", {
      maxRequests: 5,
      windowMs: 60_000,
    })
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em instantes." },
        { status: 429 }
      )
    }

    const formData = await request.clone().formData().catch(() => null)
    const email = formData?.get("email")
    if (typeof email === "string") {
      const emailRateLimit = await rateLimitByKey(
        request,
        "auth:login:email",
        email.toLowerCase().trim(),
        { maxRequests: 5, windowMs: 10 * 60_000 }
      )
      if (!emailRateLimit.success) {
        return NextResponse.json(
          { error: "Muitas tentativas. Tente novamente em instantes." },
          { status: 429 }
        )
      }
    }
  }

  return handlers.POST(request)
}
