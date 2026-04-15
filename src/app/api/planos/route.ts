import { NextRequest, NextResponse } from 'next/server'
import { validateRequest, withApiAuth } from '@/lib/api'
import { z } from 'zod'
import { createPlano, listPlanos, PlanoServiceError } from '@/services/plano.service'

const planoSchema = z.object({
  nome: z.string().min(1, 'Informe o nome'),
  descricao: z.string().nullable().optional(),
  valor: z.number().positive('Informe um valor maior que zero'),
  duracaoDias: z.number().int().positive('Informe a duração'),
  aulasSemanais: z.number().int().positive('Informe as aulas semanais'),
})

export async function GET(request: NextRequest) {
  return withApiAuth(async (session) => {
    const searchParams = request.nextUrl.searchParams
    const includeInactive = session.user.role === 'ADMIN'
      ? searchParams.get('includeInactive') === 'true'
      : false

    const includeCounts = session.user.role === 'ADMIN'
    const planos = await listPlanos({ includeInactive, includeCounts })

    return NextResponse.json(planos)
  })
}

export async function POST(request: NextRequest) {
  return withApiAuth(async () => {
    try {
      const validation = await validateRequest(request, planoSchema, {
        errorMessage: () => 'Campos obrigatórios: nome, valor, duracaoDias, aulasSemanais',
      })

      if ('error' in validation) {
        return validation.error
      }

      const plano = await createPlano(validation.data)

      return NextResponse.json(plano, { status: 201 })
    } catch (error) {
      if (error instanceof PlanoServiceError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }

      console.error('Erro ao criar plano:', error)
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
    }
  }, { requiredRole: 'ADMIN' })
}
