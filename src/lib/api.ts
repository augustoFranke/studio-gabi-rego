import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

type Role = 'ADMIN' | 'MEMBRO'

interface ApiOptions {
    requireAuth?: boolean
    requiredRole?: Role
}

/**
 * Wrapper for API routes to handle common patterns (auth, error handling)
 */
export async function withApiAuth(
    handler: (session: { user: { id: string; role: string; email?: string | null; name?: string | null; membroId?: string } }) => Promise<NextResponse>,
    options: ApiOptions = { requireAuth: true }
) {
    try {
        const session = await auth()

        if (!session && options.requireAuth) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        }

        // We can safely cast here because we checked for session if auth is required
        return await handler(session as { user: { id: string; role: string; email?: string | null; name?: string | null; membroId?: string } })
    } catch (error) {
        console.error('API Error:', error)
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        )
    }
}
