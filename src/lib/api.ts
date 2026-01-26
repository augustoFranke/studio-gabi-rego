import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

type Role = 'ADMIN' | 'MEMBRO'

interface ApiOptions {
  requireAuth?: boolean
  requiredRole?: Role
}

interface SessionUser {
  id: string
  role: Role
  email?: string | null
  name?: string | null
  membroId?: string
}

interface Session {
  user: SessionUser
}

type RequireAuthOptions = ApiOptions & { requireAuth?: true }
type OptionalAuthOptions = { requireAuth: false; requiredRole?: never }

export function withApiAuth(
  handler: (session: Session) => Promise<NextResponse>,
  options?: RequireAuthOptions
): Promise<NextResponse>
export function withApiAuth(
  handler: (session: Session | null) => Promise<NextResponse>,
  options: OptionalAuthOptions
): Promise<NextResponse>
export async function withApiAuth(
  handler: (session: Session | null) => Promise<NextResponse>,
  options: ApiOptions = { requireAuth: true }
) {
  try {
    const session = await auth()

    if (!session) {
      if (options.requireAuth !== false || options.requiredRole) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
      }

      return await handler(null)
    }

    const sessionData = session as Session

    if (options.requiredRole && sessionData.user.role !== options.requiredRole) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    return await handler(sessionData)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
