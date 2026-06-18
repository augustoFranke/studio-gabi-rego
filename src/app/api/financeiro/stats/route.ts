import { NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api'
import { getFinanceiroStats } from '@/services/financeiro.service'

export async function GET() {
  return withApiAuth(async () => {
    const stats = await getFinanceiroStats()

    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      },
    })
  }, { requiredRole: 'ADMIN' })
}
