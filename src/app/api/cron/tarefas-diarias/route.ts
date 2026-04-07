import { NextRequest, NextResponse } from 'next/server'
import { executarTodasTarefas } from '@/lib/scheduler'
import { validateCronRequest } from '@/lib/security/cron-auth'

export async function GET(request: NextRequest) {
  return POST(request)
}

export async function POST(request: NextRequest) {
  const authResult = validateCronRequest(request, process.env.CRON_SECRET)
  if (!authResult.ok) {
    if (authResult.reason === 'missing_secret') {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
    }

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const summary = await executarTodasTarefas()
    const hasFailures = summary.cobrancas.failed > 0 || summary.aniversarios.failed > 0
    return NextResponse.json(summary, { status: hasFailures ? 500 : 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno do servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
