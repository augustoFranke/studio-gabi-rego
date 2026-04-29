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

export type PrismaMockShape = Record<string, string[]>

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

export function createPrismaMock(shape: PrismaMockShape) {
  const prismaMock: Record<string, Record<string, ReturnType<typeof vi.fn>>> & {
    $transaction?: ReturnType<typeof vi.fn>
    $queryRaw?: ReturnType<typeof vi.fn>
  } = {}

  for (const [model, methods] of Object.entries(shape)) {
    prismaMock[model] = Object.fromEntries(
      methods.map((method) => [method, vi.fn()])
    )

    if (!prismaMock[model].findFirst && prismaMock[model].findUnique) {
      prismaMock[model].findFirst = vi.fn((args) => prismaMock[model].findUnique(args))
    }
  }

  prismaMock.$transaction = vi.fn(async (callbackOrOperations: unknown) => {
    if (typeof callbackOrOperations === 'function') {
      return (callbackOrOperations as (tx: typeof prismaMock) => unknown)(prismaMock)
    }
    if (Array.isArray(callbackOrOperations)) {
      return Promise.all(callbackOrOperations)
    }
    return callbackOrOperations
  })
  prismaMock.$queryRaw = vi.fn(async () => [])

  return prismaMock as Record<string, Record<string, ReturnType<typeof vi.fn>>>
}

export function createValidateRequestMock() {
  return vi.fn(
    async (
      request: Request,
      schema: MockValidationSchema,
      options?: MockValidationOptions
    ) => {
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
  )
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
