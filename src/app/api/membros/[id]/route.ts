import { NextRequest, NextResponse } from 'next/server'
import { validateRequest, withApiAuth } from '@/lib/api'
import { membroUpdateSchema } from '@/schemas/membro.schema'
import { getMembroById, MembroServiceError, updateMembroById } from '@/services/membro.service'
import { logError, safeErrorData } from '@/lib/observability/logger'
import { MEMBRO_UPDATE_FAILED } from '@/lib/observability/events'

interface Params {
    params: Promise<{
        id: string
    }>
}

// GET /api/membros/[id] - Obter detalhes do membro
export async function GET(
    _request: NextRequest,
    { params }: Params
) {
    return withApiAuth(async () => {
        const { id } = await params
        const membro = await getMembroById(id)

        if (!membro) {
            return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
        }

        return NextResponse.json(membro)
    }, { requiredRole: 'ADMIN' })
}

// PATCH /api/membros/[id] - Atualizar membro
export async function PATCH(
    request: NextRequest,
    { params }: Params
) {
    return withApiAuth(async () => {
        try {
            const { id } = await params
            const validation = await validateRequest(request, membroUpdateSchema)

            if ('error' in validation) {
                return validation.error
            }

            const membroAtualizado = await updateMembroById(id, validation.data)
            return NextResponse.json(membroAtualizado)
        } catch (error) {
            if (error instanceof MembroServiceError) {
                return NextResponse.json({ error: error.message }, { status: error.status })
            }

            logError(MEMBRO_UPDATE_FAILED, {
              message: 'Erro ao atualizar membro:',
              ...safeErrorData(error),
            })
            return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
        }
    }, { requiredRole: 'ADMIN' })
}
