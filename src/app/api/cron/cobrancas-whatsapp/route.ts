import { NextRequest, NextResponse } from 'next/server'
import { runCobrancaWhatsappT1 } from '@/lib/jobs/cobranca-whatsapp'
import { validateCronRequest } from '@/lib/security/cron-auth'
import { isEvolutionConfigured } from '@/lib/whatsapp/evolution'

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

  if (process.env.NODE_ENV === 'production' && !isEvolutionConfigured()) {
    return NextResponse.json({ error: 'Evolution API not configured' }, { status: 500 })
  }

  try {
    const summary = await runCobrancaWhatsappT1()
    const status = summary.failed > 0 ? 500 : 200
    return NextResponse.json(summary, { status })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno do servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
