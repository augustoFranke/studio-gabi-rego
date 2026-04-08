import type { Session } from 'next-auth'

export const USER_ROLES = ['ADMIN', 'MEMBRO'] as const

export type UserRole = (typeof USER_ROLES)[number]

export type AppSessionUser = Session['user'] & {
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

export function isAppSession(value: unknown): value is AppSession {
  if (!value || typeof value !== 'object') {
    return false
  }

  const user = (value as { user?: unknown }).user
  if (!user || typeof user !== 'object') {
    return false
  }

  const typedUser = user as { id?: unknown; role?: unknown; membroId?: unknown }

  if (typeof typedUser.id !== 'string' || !isUserRole(typedUser.role)) {
    return false
  }

  if (typedUser.membroId !== undefined && typeof typedUser.membroId !== 'string') {
    return false
  }

  return true
}
