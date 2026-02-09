import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withApiAuth, validateRequest } from '@/lib/api'
import { prisma } from '@/lib/prisma'

const updateConfiguracoesSchema = z.object({
  configuracoes: z.array(
    z.object({
      id: z.string().min(1),
      valor: z.string(),
    })
  ).min(1, 'Nenhuma configuração enviada'),
})

const configuracaoSelect = {
  id: true,
  chave: true,
  valor: true,
  descricao: true,
  atualizadoEm: true,
}

export async function GET() {
  return withApiAuth(async () => {
    const configuracoes = await prisma.configuracao.findMany({
      select: configuracaoSelect,
      orderBy: { chave: 'asc' },
    })

    return NextResponse.json(configuracoes)
  }, { requiredRole: 'ADMIN' })
}

export async function PUT(request: NextRequest) {
  return withApiAuth(async () => {
    const validation = await validateRequest(request, updateConfiguracoesSchema)
    if ('error' in validation) {
      return validation.error
    }

    await prisma.$transaction(
      validation.data.configuracoes.map((configuracao) =>
        prisma.configuracao.update({
          where: { id: configuracao.id },
          data: { valor: configuracao.valor },
        })
      )
    )

    const configuracoes = await prisma.configuracao.findMany({
      select: configuracaoSelect,
      orderBy: { chave: 'asc' },
    })

    return NextResponse.json(configuracoes)
  }, { requiredRole: 'ADMIN' })
}
