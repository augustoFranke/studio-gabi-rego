import { NextRequest, NextResponse } from 'next/server'
import { runCleanup } from '@/lib/cleanup'
import { validateCronRequest } from '@/lib/security/cron-auth'
import { runWithExecutionContext } from '@/lib/observability/request-context'
import { logInfo, logError, safeErrorData } from '@/lib/observability/logger'
import { CRON_RUN_STARTED, CRON_RUN_COMPLETED, CRON_RUN_FAILED } from '@/lib/observability/events'
import { getRequiredCronSecretConfig } from '@/lib/runtime-config'

const ROUTE = '/api/cron/cleanup'
const JOB_NAME = 'cleanup'

export async function GET(request: NextRequest) {
  return POST(request)
}

export async function POST(request: NextRequest) {
  return runWithExecutionContext(
    { source: 'cron', route: ROUTE, jobName: JOB_NAME },
    async () => {
      const authResult = validateCronRequest(request, getRequiredCronSecretConfig())
      if (!authResult.ok) {
        if (authResult.reason === 'missing_secret') {
          return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
        }
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const startTime = Date.now()
      logInfo(CRON_RUN_STARTED, { jobName: JOB_NAME })

      try {
        const summary = await runCleanup()
        const durationMs = Date.now() - startTime
        logInfo(CRON_RUN_COMPLETED, { jobName: JOB_NAME, durationMs })

        return NextResponse.json(summary)
      } catch (error) {
        const durationMs = Date.now() - startTime
        logError(CRON_RUN_FAILED, {
          jobName: JOB_NAME,
          durationMs,
          ...safeErrorData(error),
        })

        const message = error instanceof Error ? error.message : 'Erro interno do servidor'
        return NextResponse.json({ error: message }, { status: 500 })
      }
    },
  )
}
