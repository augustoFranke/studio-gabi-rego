import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth, validateRequest } from '@/lib/api'
import { parseLocalDate } from '@/lib/schedule'
import { z } from 'zod'
import { Prisma, StatusPagamento } from '@prisma/client'

const requiredString = (message: string) => z.string().min(1, message)

const pagamentoSchema = z.object({
  membroId: requiredString('Selecione um aluno'),
  planoId: requiredString('Selecione um plano'),
  valor: z.number().positive('Valor deve ser maior que zero'),
  dataVencimento: requiredString('Informe a data de vencimento'),
  formaPagamento: requiredString('Selecione a forma de pagamento'),
  observacao: z.string().optional(),
})

// GET /api/pagamentos - Listar pagamentos
export async function GET(request: NextRequest) {
  return withApiAuth(async (session) => {
    if (session.user.role === 'MEMBRO' && !session.user.membroId) {
      return NextResponse.json({ error: 'Perfil incompleto' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const membroId = searchParams.get('membroId')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') || 'recent_desc'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const skip = (page - 1) * limit

    const where: Prisma.PagamentoWhereInput = {}


    // Se for membro, só pode ver seus próprios pagamentos
    if (session.user.role === 'MEMBRO' && session.user.membroId) {
      where.membroId = session.user.membroId
    } else if (membroId) {
      where.membroId = membroId
    }

    if (status && status !== 'all') {
      where.status = status as StatusPagamento
    }

    // Search by member name
    if (search) {
      where.membro = {
        usuario: {
          nome: { contains: search, mode: 'insensitive' }
        }
      }
    }

    const orderBy: Prisma.PagamentoOrderByWithRelationInput =
      sort === 'recent_desc'
        ? { criadoEm: 'desc' }
        : sort === 'vencimento_asc'
          ? { dataVencimento: 'asc' }
          : { dataVencimento: 'desc' }

    // Run count and findMany in parallel for efficiency
    const [total, pagamentos] = await Promise.all([
      prisma.pagamento.count({ where }),
      prisma.pagamento.findMany({
        where,
        include: {
          membro: {
            include: {
              usuario: {
                select: { nome: true },
              },
            },
          },
          plano: true,
        },
        orderBy,
        skip,
        take: limit,
      }),
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      data: pagamentos,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    })
  })
}


// POST /api/pagamentos - Criar novo pagamento (admin only)
export async function POST(request: NextRequest) {
  return withApiAuth(async () => {
    const validation = await validateRequest(request, pagamentoSchema)

    if ('error' in validation) {
      return validation.error
    }

    const { membroId, planoId, valor, dataVencimento, formaPagamento, observacao } = validation.data

    const pagamento = await prisma.pagamento.create({
      data: {
        membroId,
        planoId,
        valor,
        dataVencimento: parseLocalDate(dataVencimento),
        formaPagamento,
        observacao,
      },
      include: {
        membro: {
          include: {
            usuario: {
              select: { nome: true },
            },
          },
        },
        plano: true,
      },
    })

    return NextResponse.json(pagamento, { status: 201 })
  }, { requiredRole: 'ADMIN' })
}
