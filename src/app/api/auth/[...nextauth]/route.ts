import { NextRequest, NextResponse } from "next/server"
import { handlers } from "@/lib/auth"
import { rateLimitByIp } from "@/lib/rate-limit"

// Force Node.js runtime for auth routes (Prisma doesn't work in Edge)
export const runtime = 'nodejs'

export const GET = handlers.GET

export async function POST(request: NextRequest) {
  const url = new URL(request.url)

  if (url.pathname.includes("/callback/credentials")) {
    const rateLimit = await rateLimitByIp(request, "auth:login")
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em instantes." },
        { status: 429 }
      )
    }
  }

  return handlers.POST(request)
}
