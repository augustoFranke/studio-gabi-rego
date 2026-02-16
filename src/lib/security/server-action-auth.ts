import { auth } from '@/lib/auth'

type ForbiddenReason = 'missing_session' | 'missing_user' | 'insufficient_role'

type RequireAdminActionParams = {
  action: string
  resourceId?: string
}

type AuthorizedResult = {
  allowed: true
  session: Awaited<ReturnType<typeof auth>>
}

type UnauthorizedResult = {
  allowed: false
  message: 'Unauthorized'
}

export type RequireAdminActionResult = AuthorizedResult | UnauthorizedResult

function logForbiddenAttempt(
  params: RequireAdminActionParams,
  context: {
    actorId?: string
    actorRole?: string
    reason: ForbiddenReason
  }
) {
  console.warn('[server_action_forbidden]', {
    event: 'server_action_forbidden',
    action: params.action,
    actorId: context.actorId ?? null,
    actorRole: context.actorRole ?? null,
    resourceId: params.resourceId ?? null,
    reason: context.reason,
  })
}

export async function requireAdminAction(
  params: RequireAdminActionParams
): Promise<RequireAdminActionResult> {
  const session = await auth()

  if (!session?.user) {
    logForbiddenAttempt(params, {
      reason: !session ? 'missing_session' : 'missing_user',
    })
    return { allowed: false, message: 'Unauthorized' }
  }

  if (session.user.role !== 'ADMIN') {
    logForbiddenAttempt(params, {
      actorId: session.user.id,
      actorRole: session.user.role,
      reason: 'insufficient_role',
    })
    return { allowed: false, message: 'Unauthorized' }
  }

  return {
    allowed: true,
    session,
  }
}
