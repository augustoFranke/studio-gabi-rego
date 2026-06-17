import { NextRequest, NextResponse } from 'next/server'
import { validateRequest, withApiAuth } from '@/lib/api'
import { listPagamentos, createPagamento, PagamentoServiceError } from '@/services/pagamento.service'
import { pagamentoCreateSchema, pagamentosQuerySchema } from '@/features/finance/contracts'
import { logError, safeErrorData } from '@/lib/observability/logger'
import { PAGAMENTO_LIST_FAILED } from '@/lib/observability/events'

export async function GET(request: NextRequest) {
  return withApiAuth(async (session) => {
    const searchParams = request.nextUrl.searchParams
    const validation = pagamentosQuerySchema.safeParse({
      membroId: searchParams.get('membroId'),
      status: searchParams.get('status'),
      search: searchParams.get('search'),
      sort: searchParams.get('sort') || 'recent_desc',
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '10',
    })

    if (!validation.success) {
      return NextResponse.json({ error: 'Filtros inválidos' }, { status: 400 })
    }

    const { membroId, status, search, sort, page, limit } = validation.data

    try {
      const result = await listPagamentos({
        sessionRole: session.user.role,
        sessionMembroId: session.user.membroId,
        membroId,
        status,
        search,
        sort,
        page,
        limit,
      })

      return NextResponse.json(result)
    } catch (error) {
      if (error instanceof PagamentoServiceError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }

      logError(PAGAMENTO_LIST_FAILED, {
        message: 'Erro ao listar pagamentos:',
        ...safeErrorData(error),
      })
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
    }
  })
}


export async function POST(request: NextRequest) {
  return withApiAuth(async () => {
    const validation = await validateRequest(request, pagamentoCreateSchema)

    if ('error' in validation) {
      return validation.error
    }

    const pagamento = await createPagamento(validation.data)
    return NextResponse.json(pagamento, { status: 201 })
  }, { requiredRole: 'ADMIN' })
}
