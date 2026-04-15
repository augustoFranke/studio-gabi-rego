import type { Session } from 'next-auth'

export const USER_ROLES = ['ADMIN', 'MEMBRO'] as const

export type UserRole = (typeof USER_ROLES)[number]

export type AppSessionUser = NonNullable<Session['user']> & {
  id: string
  role: UserRole
  membroId?: string
}

export type AppSession = Session & {
  user: AppSessionUser
}

export function isUserRole(value: unknown): value is UserRole {
  return value === 'ADMIN' || value === 'MEMBRO'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function isAppSession(value: unknown): value is AppSession {
  if (!isRecord(value)) {
    return false
  }

  const user = value.user
  if (!isRecord(user)) {
    return false
  }

  if (typeof user.id !== 'string' || !isUserRole(user.role)) {
    return false
  }

  if (user.membroId !== undefined && typeof user.membroId !== 'string') {
    return false
  }

  return true
}
