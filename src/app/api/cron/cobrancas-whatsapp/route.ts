import { NextRequest, NextResponse } from 'next/server'
import { runCobrancaWhatsappT1 } from '@/lib/jobs/cobranca-whatsapp'
import { isEvolutionConfigured } from '@/lib/whatsapp/evolution'

function getToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || ''
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim()
  }

  return request.nextUrl.searchParams.get('secret') || ''
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const token = getToken(request)
  if (!token || token !== secret) {
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
