import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

// GET /api/planos - Listar todos os planos
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const includeInactive = searchParams.get('includeInactive') === 'true'

  const planos = await prisma.plano.findMany({
    where: includeInactive ? {} : { ativo: true },
    orderBy: { valor: 'asc' },
    include: {
      _count: {
        select: { membros: true, pagamentos: true }
      }
    }
  })

  return NextResponse.json(planos)
}

// POST /api/planos - Criar novo plano (admin only)
export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { nome, descricao, valor, duracaoDias, aulasSemanais } = body

    if (!nome || !valor || !duracaoDias || !aulasSemanais) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: nome, valor, duracaoDias, aulasSemanais' },
        { status: 400 }
      )
    }

    const plano = await prisma.plano.create({
      data: {
        nome,
        descricao,
        valor,
        duracaoDias,
        aulasSemanais,
      },
    })

    return NextResponse.json(plano, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar plano:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

