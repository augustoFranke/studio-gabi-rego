import { NextRequest, NextResponse } from "next/server"
import { withApiAuth } from "@/lib/api"
import { createAnamneseLinkForMembro } from "@/services/onboarding.service"

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
    const { id } = await params
    return NextResponse.json(
      await createAnamneseLinkForMembro(id, request.nextUrl.origin)
    )
  }, { requiredRole: "ADMIN" })
}
