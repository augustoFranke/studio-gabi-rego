import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { runWithExecutionContext } from "@/lib/observability/request-context"
import { logInfo, logError, safeErrorData } from "@/lib/observability/logger"
import { HEALTH_CHECK_OK, HEALTH_CHECK_FAILED } from "@/lib/observability/events"

/**
 * Public health check endpoint for local Docker smoke tests and infrastructure probes.
 * GET /api/health
 */
export async function GET() {
  return runWithExecutionContext(
    { source: 'request', route: '/api/health' },
    async () => {
      try {
        await prisma.$queryRaw`SELECT 1`

        logInfo(HEALTH_CHECK_OK, { database: 'connected' })

        return NextResponse.json(
          {
            status: "healthy",
            timestamp: new Date().toISOString(),
            services: {
              database: "connected",
              app: "running",
            },
          },
          { status: 200 }
        )
      } catch (error) {
        logError(HEALTH_CHECK_FAILED, {
          database: 'disconnected',
          ...safeErrorData(error),
        })

        const includeErrorDetails = process.env.NODE_ENV !== "production"

        return NextResponse.json(
          {
            status: "unhealthy",
            timestamp: new Date().toISOString(),
            services: {
              database: "disconnected",
              app: "running",
            },
            error: includeErrorDetails && error instanceof Error ? error.message : "Erro interno",
          },
          { status: 503 }
        )
      }
    },
  )
}
