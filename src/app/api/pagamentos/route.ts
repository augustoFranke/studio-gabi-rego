import { NextRequest, NextResponse } from 'next/server'
import { validateRequest, withApiAuth } from '@/lib/api'
import { z } from 'zod'
import { listPagamentos, createPagamento, PagamentoServiceError } from '@/services/pagamento.service'

const requiredString = (message: string) => z.string().min(1, message)

const pagamentoSchema = z.object({
  membroId: requiredString('Selecione um aluno'),
  planoId: requiredString('Selecione um plano'),
  valor: z.number().positive('Valor deve ser maior que zero'),
  dataVencimento: requiredString('Informe a data de vencimento'),
  formaPagamento: requiredString('Selecione a forma de pagamento'),
  observacao: z.string().nullable().optional(),
})

export async function GET(request: NextRequest) {
  return withApiAuth(async (session) => {
    const searchParams = request.nextUrl.searchParams
    const membroId = searchParams.get('membroId')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') || 'recent_desc'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
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

      console.error('Erro ao listar pagamentos:', error)
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
    }
  })
}


export async function POST(request: NextRequest) {
  return withApiAuth(async () => {
    const validation = await validateRequest(request, pagamentoSchema)

    if ('error' in validation) {
      return validation.error
    }

    const pagamento = await createPagamento(validation.data)
    return NextResponse.json(pagamento, { status: 201 })
  }, { requiredRole: 'ADMIN' })
}
