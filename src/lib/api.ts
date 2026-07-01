import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import type { ZodError, ZodSchema } from 'zod'
import { ApiError } from '@/lib/api-error'
import { type AppSession, isAppSession, type UserRole } from '@/lib/auth-session'
import { API_UNHANDLED_ERROR, AUTH_SESSION_ERROR } from '@/lib/observability/events'
import { logError, safeErrorData } from '@/lib/observability/logger'

interface ApiOptions {
  requireAuth?: boolean
  requiredRole?: UserRole
}

type RequireAuthOptions = ApiOptions & { requireAuth?: true }
type OptionalAuthOptions = { requireAuth: false; requiredRole?: never }

export function withApiAuth(
  handler: (session: AppSession) => Promise<NextResponse>,
  options?: RequireAuthOptions
): Promise<NextResponse>

export function withApiAuth(
  handler: (session: AppSession | null) => Promise<NextResponse>,
  options: OptionalAuthOptions
): Promise<NextResponse>

export async function withApiAuth(
  handler: unknown,
  options?: unknown
): Promise<NextResponse> {
  const resolvedOptions: ApiOptions = (options as ApiOptions | undefined) ?? { requireAuth: true }
  const authHandler = handler as (session: AppSession | null) => Promise<NextResponse>
  try {
    const session = await auth()

    if (!session) {
      if (resolvedOptions.requireAuth !== false || resolvedOptions.requiredRole) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
      }

      return await authHandler(null)
    }

    if (!isAppSession(session)) {
      logError(AUTH_SESSION_ERROR, {
        reason: 'invalid_session_shape',
        hasUser: typeof session === 'object' && session !== null && 'user' in session,
      })
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
    }

    if (resolvedOptions.requiredRole && session.user.role !== resolvedOptions.requiredRole) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    return await authHandler(session)
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    logError(API_UNHANDLED_ERROR, {
      message: 'API Error:',
      ...safeErrorData(error),
    })
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
  session: Pick<AppSession, 'user'>,
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
  request: Request,
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
