import { NextResponse } from "next/server"
import { withApiAuth } from "@/lib/api"
import { rateLimitByIp, rateLimitByKey } from "@/lib/rate-limit"
import { issuePasswordResetLink } from "@/services/account-recovery.service"
import { z } from "zod"

const resetRequestSchema = z.object({
  usuarioId: z.string().min(1),
})

export async function POST(request: Request) {
  return withApiAuth(async () => {
    const rateLimit = await rateLimitByIp(request, "auth:admin-reset", {
      maxRequests: 5,
      windowMs: 60_000,
    })
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em instantes." },
        { status: 429 }
      )
    }

    const validation = resetRequestSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json(
        { error: "ID do usuário é obrigatório" },
        { status: 400 }
      )
    }

    const targetRateLimit = await rateLimitByKey(
      request,
      "auth:admin-reset:target",
      validation.data.usuarioId,
      { maxRequests: 3, windowMs: 10 * 60_000 }
    )
    if (!targetRateLimit.success) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em instantes." },
        { status: 429 }
      )
    }

    const result = await issuePasswordResetLink(validation.data.usuarioId, new URL(request.url).origin)

    return NextResponse.json(result)
  }, { requiredRole: "ADMIN" })
}
