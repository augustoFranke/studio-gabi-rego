import { NextRequest, NextResponse } from 'next/server'
import { runCobrancaWhatsappT1 } from '@/lib/jobs/cobranca-whatsapp'
import { validateCronRequest } from '@/lib/security/cron-auth'
import { isEvolutionConfigured } from '@/lib/whatsapp/evolution'
import { runWithExecutionContext } from '@/lib/observability/request-context'
import { logInfo, logWarn, logError, safeErrorData } from '@/lib/observability/logger'
import { CRON_RUN_STARTED, CRON_RUN_COMPLETED, CRON_RUN_FAILED, PROVIDER_NOT_CONFIGURED } from '@/lib/observability/events'
import { getRequiredCronSecretConfig } from '@/lib/runtime-config'

const ROUTE = '/api/cron/cobrancas-whatsapp'
const JOB_NAME = 'cobrancas-whatsapp'

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

      if (process.env.NODE_ENV === 'production' && !isEvolutionConfigured()) {
        logWarn(PROVIDER_NOT_CONFIGURED, { provider: 'evolution', jobName: JOB_NAME })
        return NextResponse.json({ error: 'Evolution API not configured' }, { status: 500 })
      }

      const startTime = Date.now()
      logInfo(CRON_RUN_STARTED, { jobName: JOB_NAME })

      try {
        const summary = await runCobrancaWhatsappT1()
        const durationMs = Date.now() - startTime
        const hasFailures = summary.failed > 0

        if (hasFailures) {
          logError(CRON_RUN_COMPLETED, {
            jobName: JOB_NAME,
            durationMs,
            hasFailures: true,
            failed: summary.failed,
          })
        } else {
          logInfo(CRON_RUN_COMPLETED, {
            jobName: JOB_NAME,
            durationMs,
            hasFailures: false,
          })
        }

        const status = hasFailures ? 500 : 200
        return NextResponse.json(summary, { status })
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
