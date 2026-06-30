import { NextRequest, NextResponse } from 'next/server'
import { validateRequest, withApiAuth } from '@/lib/api'
import { z } from 'zod'
import {
  deletePlanoById,
  getPlanoById,
  updatePlanoById,
} from '@/services/plano.service'

const planoUpdateSchema = z.object({
  nome: z.string().min(1).optional(),
  descricao: z.string().nullable().optional(),
  valor: z.number().positive().optional(),
  duracaoDias: z.number().int().positive().optional(),
  aulasSemanais: z.number().int().positive().optional(),
  ativo: z.boolean().optional(),
}).refine((data) => Object.values(data).some((value) => value !== undefined), {
  message: 'Nenhum dado para atualizar',
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(async (session) => {
    const { id } = await params
    const plano = await getPlanoById(id, session.user.role === 'ADMIN')

    if (!plano) {
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
    }

    return NextResponse.json(plano)
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(async () => {
    const { id } = await params
    const validation = await validateRequest(request, planoUpdateSchema)

    if ('error' in validation) {
      return validation.error
    }

    const plano = await updatePlanoById(id, validation.data)

    return NextResponse.json(plano)
  }, { requiredRole: 'ADMIN' })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(async () => {
    const { id } = await params
    const result = await deletePlanoById(id)

    if (result.action === 'deactivated' && result.plano) {
      return NextResponse.json({
        ...result.plano,
        message: `Plano desativado. ${result.membrosAtivos} membro(s) ativo(s) ainda usam este plano.`
      })
    }

    return NextResponse.json({ message: 'Plano removido com sucesso' })
  }, { requiredRole: 'ADMIN' })
}
