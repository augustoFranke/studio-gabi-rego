import { NextRequest, NextResponse } from 'next/server'
import { validateRequest, withApiAuth } from '@/lib/api'
import { StatusPagamento } from '@prisma/client'
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

const pagamentosQuerySchema = z.object({
  membroId: z.string().min(1).nullable(),
  status: z.union([z.nativeEnum(StatusPagamento), z.literal('all')]).nullable(),
  search: z.string().trim().max(120).nullable(),
  sort: z.enum(['recent_desc', 'vencimento_asc', 'vencimento_desc']).catch('recent_desc'),
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(10),
})

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
