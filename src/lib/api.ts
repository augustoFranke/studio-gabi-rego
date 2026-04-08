import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import type { ZodError, ZodSchema } from 'zod'
import { type AppSession, isAppSession, type UserRole } from '@/lib/auth-session'
import { AUTH_SESSION_ERROR } from '@/lib/observability/events'
import { logError } from '@/lib/observability/logger'

interface ApiOptions {
  requireAuth?: boolean
  requiredRole?: UserRole
}

type RequireAuthOptions = ApiOptions & { requireAuth?: true }
type OptionalAuthOptions = { requireAuth: false; requiredRole?: never }
type AuthOptions = RequireAuthOptions | OptionalAuthOptions

export async function withApiAuth<T extends AuthOptions = RequireAuthOptions>(
  handler: (
    session: T extends OptionalAuthOptions ? AppSession | null : AppSession
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

      return await (handler as (session: AppSession | null) => Promise<NextResponse>)(null)
    }

    if (!isAppSession(session)) {
      logError(AUTH_SESSION_ERROR, {
        reason: 'invalid_session_shape',
        hasUser: Boolean((session as { user?: unknown }).user),
      })
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
    }

    const sessionData = session

    if (resolvedOptions.requiredRole && sessionData.user.role !== resolvedOptions.requiredRole) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    return await (handler as (session: AppSession) => Promise<NextResponse>)(sessionData)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

type ValidationResult<T> = { data: T } | { error: NextResponse }

type ValidationOptions<T> = {
  invalidJsonMessage?: string
  errorMessage?: (error: ZodError<T>) => string
}

type OwnerCheckOptions = {
  status?: number
  error?: string
}

export function ensureOwnerOrAdmin(
  session: { user: { role: UserRole; membroId?: string | null } },
  ownerId?: string | null,
  options?: OwnerCheckOptions
) {
  if (session.user.role === 'MEMBRO' && ownerId !== session.user.membroId) {
    return NextResponse.json(
      { error: options?.error ?? 'Não autorizado' },
      { status: options?.status ?? 403 }
    )
  }

  return null
}

export async function validateRequest<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
  options?: ValidationOptions<T>
): Promise<ValidationResult<T>> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return {
      error: NextResponse.json(
        { error: options?.invalidJsonMessage ?? 'Dados inválidos enviados. Verifique o formulário.' },
        { status: 400 }
      ),
    }
  }

  const validation = schema.safeParse(body)
  if (!validation.success) {
    const message =
      options?.errorMessage?.(validation.error) ??
      validation.error.issues[0]?.message ??
      'Dados inválidos enviados. Verifique o formulário.'
    return { error: NextResponse.json({ error: message }, { status: 400 }) }
  }

  return { data: validation.data }
}
