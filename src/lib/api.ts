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
type AuthOptions = RequireAuthOptions | OptionalAuthOptions

export async function withApiAuth<T extends AuthOptions = RequireAuthOptions>(
  handler: (
    session: T extends OptionalAuthOptions ? Session | null : Session
  ) => Promise<NextResponse>,
  options?: T
) {
  const resolvedOptions: ApiOptions = options ?? { requireAuth: true }
  try {
    const session = await auth()

    if (!session) {
      if (resolvedOptions.requireAuth !== false || resolvedOptions.requiredRole) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
      }

      return await (handler as (session: Session | null) => Promise<NextResponse>)(null)
    }

    const sessionData = session as Session

    if (resolvedOptions.requiredRole && sessionData.user.role !== resolvedOptions.requiredRole) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    return await (handler as (session: Session) => Promise<NextResponse>)(sessionData)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
