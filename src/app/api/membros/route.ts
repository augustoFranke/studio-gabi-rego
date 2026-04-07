import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth, validateRequest } from '@/lib/api'
import { membroCreateSchema } from '@/schemas/membro.schema'
import { createAdminMembro, listMembros, MembroServiceError } from '@/services/membro.service'
import { StatusMembro } from '@prisma/client'

// GET /api/membros - Listar todos os membros
export async function GET(request: NextRequest) {
  return withApiAuth(async () => {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const fields = searchParams.get('fields')

    const membros = await listMembros({
      status: status && status !== 'todos' ? (status as StatusMembro) : undefined,
      compact: fields === 'compact',
    })

    return NextResponse.json(membros)
  }, { requiredRole: 'ADMIN' })
}

// POST /api/membros - Criar novo membro
export async function POST(request: NextRequest) {
  return withApiAuth(async () => {
    const validation = await validateRequest(request, membroCreateSchema, {
      invalidJsonMessage: "Dados inválidos enviados. Verifique o formulário.",
      errorMessage: (error) => {
        const issue = error.issues[0]
        const path = issue.path.join('.')
        return `Erro no campo '${path}': ${issue.message}`
      },
    })

    if ('error' in validation) {
      return validation.error
    }
    try {
      const membro = await createAdminMembro(validation.data)

      return NextResponse.json(membro, { status: 201 })
    } catch (error) {
      if (error instanceof MembroServiceError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }

      throw error
    }
  }, { requiredRole: 'ADMIN' })
}
