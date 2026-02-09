import { NextRequest, NextResponse } from 'next/server'
import { executarTodasTarefas } from '@/lib/scheduler'

function getToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || ''
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim()
  }

  return ''
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

  try {
    const summary = await executarTodasTarefas()
    return NextResponse.json(summary)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno do servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
