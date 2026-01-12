import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth } from '@/lib/api'
import { parseLocalDate } from '@/lib/schedule'
import { z } from 'zod'
import { Prisma, StatusPagamento } from '@prisma/client'

const pagamentoSchema = z.object({
  membroId: z.string().optional(),
  planoId: z.string().optional(),
  valor: z.number().optional(),
  dataVencimento: z.string().optional(),
  formaPagamento: z.string().optional(),
  observacao: z.string().optional(),
})

// GET /api/pagamentos - Listar pagamentos
export async function GET(request: NextRequest) {
  return withApiAuth(async (session) => {
    const searchParams = request.nextUrl.searchParams
    const membroId = searchParams.get('membroId')
    const status = searchParams.get('status')

    const where: Prisma.PagamentoWhereInput = {}

    // Se for membro, só pode ver seus próprios pagamentos
    if (session.user.role === 'MEMBRO' && session.user.membroId) {
      where.membroId = session.user.membroId
    } else if (membroId) {
      where.membroId = membroId
    }

    if (status) {
      where.status = status as StatusPagamento
    }

    const pagamentos = await prisma.pagamento.findMany({
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
      orderBy: { dataVencimento: 'desc' },
    })

    return NextResponse.json(pagamentos)
  })
}

// POST /api/pagamentos - Criar novo pagamento (admin only)
export async function POST(request: NextRequest) {
  return withApiAuth(async () => {
    const body = await request.json()
    const validation = pagamentoSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
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

