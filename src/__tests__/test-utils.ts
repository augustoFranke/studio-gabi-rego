import { NextRequest, NextResponse } from 'next/server'
import { vi } from 'vitest'

export type TestSession = {
  user: {
    role: 'ADMIN' | 'MEMBRO'
    membroId?: string
    id?: string
  }
}

export type SessionRef = { current: TestSession }

export type MockValidationError = {
  issues: { message: string; path: Array<string | number> }[]
}

export type MockValidationSchema = {
  safeParse: (data: unknown) =>
    | { success: true; data: unknown }
    | { success: false; error: MockValidationError }
}

export type MockValidationOptions = {
  invalidJsonMessage?: string
  errorMessage?: (error: MockValidationError) => string
}

export function createSessionRef(initial?: TestSession): SessionRef {
  return {
    current: initial ?? { user: { role: 'ADMIN', membroId: 'm-admin' } },
  }
}

export function mockWithApiAuth(sessionRef: SessionRef) {
  return {
    withApiAuth: vi.fn(
      async (
        handler: (session: SessionRef['current']) => Promise<NextResponse>,
        options?: { requiredRole?: 'ADMIN' | 'MEMBRO'; requireAuth?: boolean }
      ) => {
        if (options?.requiredRole && sessionRef.current.user.role !== options.requiredRole) {
          return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
        }
        return handler(sessionRef.current)
      }
    ),
  }
}

export function createJsonRequest(
  url: string,
  body: Record<string, unknown>,
  method: string = 'POST'
) {
  return new NextRequest(url, {
    method,
    body: JSON.stringify(body),
  })
}
