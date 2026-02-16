# Testing Patterns

**Analysis Date:** 2026-02-16

## Test Framework

**Runner:**
- Vitest 4.x
- Config: `vitest.config.ts`
- Environment: `node`
- Globals: `true` (describe, it, expect available without import, but tests still explicitly import them)

**Assertion Library:**
- Vitest built-in `expect` (Chai-compatible)

**Run Commands:**
```bash
npm test                # Run vitest in watch mode
npm run test:run        # Run all tests once (CI/pre-commit)
npm run test:coverage   # Run with v8 coverage
```

## Test File Organization

**Location:**
- All tests are in a centralized `src/__tests__/` directory (not co-located with source)
- Organized by category subdirectories mirroring the source structure

**Naming:**
- `{name}.test.ts` (never `.spec.ts`)

**Structure:**
```
src/__tests__/
  setup.ts              # Global test setup
  test-utils.ts         # Shared test utilities
  globals.d.ts          # Global type declarations for test utils
  api/                  # API route handler tests
    membros.test.ts
    membros-id.test.ts
    agendamentos.test.ts
    health.test.ts
    planos.test.ts
    treinos.test.ts
    treinos-id.test.ts
    treinos-gerar-pdf.test.ts
    cron-cobrancas-whatsapp.test.ts
    auth-cadastro.test.ts
    auth-nextauth.test.ts
    ... (25+ API test files)
  actions/              # Server action tests
    membros.test.ts
  lib/                  # Library/utility tests
    api.test.ts
    dates.test.ts
    schedule.test.ts
    treino-editor.test.ts
    whatsapp-evolution.test.ts
  schemas/              # Zod schema validation tests
    auth.schema.test.ts
    membro.schema.test.ts
    treino.schema.test.ts
  services/             # Service layer tests
    membro.service.test.ts
    treino.service.test.ts
  pdf/                  # PDF generation tests
    generation.test.ts
    fixtures.ts
```

## Test Setup

**Global Setup File:** `src/__tests__/setup.ts`
- Configured via `vitest.config.ts` > `setupFiles`
- Registers shared test utilities on `globalThis.__testUtils`
- Sets `NODE_ENV=test` and `VITEST=true`

```typescript
// src/__tests__/setup.ts
import { createPrismaMock, createSessionRef, createValidateRequestMock, mockWithApiAuth } from '@/__tests__/test-utils'

globalThis.__testUtils = {
  createPrismaMock,
  createSessionRef,
  createValidateRequestMock,
  mockWithApiAuth,
}

process.env.NODE_ENV = 'test'
process.env.VITEST = 'true'
```

**Global Type Declarations:** `src/__tests__/globals.d.ts`
```typescript
import type * as testUtils from '@/__tests__/test-utils'

declare global {
  var __testUtils: typeof testUtils
}
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Feature Name', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should do expected behavior', async () => {
    // Arrange
    vi.mocked(prisma.membro.findUnique).mockResolvedValue(null)

    // Act
    const res = await GET(req)
    const json = await res.json()

    // Assert
    expect(res.status).toBe(200)
    expect(json.id).toBe('expected-id')
  })
})
```

**Patterns:**
- Always call `vi.clearAllMocks()` in `beforeEach`
- Use `vi.mocked()` for type-safe mock assertions
- Test names use `should ...` or descriptive phrases
- Nested `describe` blocks for grouping related tests within a suite

## Mocking

**Framework:** Vitest built-in `vi.mock()`, `vi.fn()`, `vi.hoisted()`

### Pattern 1: Prisma Mock (Direct)
Used for simple tests with few Prisma models:
```typescript
vi.mock('@/lib/prisma', () => ({
  prisma: {
    membro: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))
```

### Pattern 2: Prisma Mock (Factory via `createPrismaMock`)
Used for complex API tests with many models:
```typescript
const { prismaMock } = vi.hoisted(() => {
  const { createPrismaMock } = globalThis.__testUtils
  return {
    prismaMock: createPrismaMock({
      agendamento: ['findMany', 'count', 'findFirst', 'create'],
      membro: ['findUnique'],
      horarioDisponivel: ['findUnique'],
    }),
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
```

### Pattern 3: Auth Mock (via `mockWithApiAuth`)
Simulates the `withApiAuth` wrapper with configurable session:
```typescript
const { withApiAuthMock, sessionRef } = vi.hoisted(() => {
  const { createSessionRef, mockWithApiAuth } = globalThis.__testUtils
  const sessionRef = createSessionRef({ user: { role: 'ADMIN' } })
  return {
    sessionRef,
    withApiAuthMock: mockWithApiAuth(sessionRef).withApiAuth,
  }
})

vi.mock('@/lib/api', () => ({
  withApiAuth: withApiAuthMock,
  validateRequest: validateRequestMock,
}))

// In tests, change session dynamically:
sessionRef.current = { user: { role: 'MEMBRO', membroId: 'm-1' } }
```

### Pattern 4: Validation Mock (via `createValidateRequestMock`)
Replaces `validateRequest` with a mock that actually parses JSON and validates:
```typescript
const { validateRequestMock } = vi.hoisted(() => ({
  validateRequestMock: globalThis.__testUtils.createValidateRequestMock(),
}))
```

### Pattern 5: Simple Module Mocks
```typescript
vi.mock('bcryptjs', () => ({
  hash: vi.fn((pwd) => Promise.resolve(`hashed_${pwd}`)),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))
```

**What to Mock:**
- `@/lib/prisma` -- always mock, never hit real DB in unit tests
- `@/lib/api` -- mock `withApiAuth` and `validateRequest` for API route tests
- `@/lib/auth` -- mock `auth()` for direct auth testing
- External services: `bcryptjs`, `next/cache`, WhatsApp API clients
- `@/lib/validators` -- mock when testing schemas that depend on them

**What NOT to Mock:**
- The code under test (route handlers, services, schemas)
- Zod schemas (test their actual validation logic)
- Pure utility functions (`src/lib/dates.ts`, `src/lib/schedule.ts`)
- PDF generation (`src/lib/pdf.ts`) -- tested with real output validation

## Fixtures and Factories

**Test Data:**
PDF test fixtures in `src/__tests__/pdf/fixtures.ts`:
```typescript
export type PDFData = TrainingPDFData

export const testPDFData: PDFData = {
  aluno: 'Maria Silva',
  date: '01/2026',
  observacoes: 'Focar em postura durante agachamentos',
  sessions: [
    {
      name: 'A',
      exercises: [
        { name: 'Supino Reto', sets: '4', reps: '12' },
      ]
    },
  ]
}
```

**Request Factory:**
`createJsonRequest()` from `src/__tests__/test-utils.ts`:
```typescript
export function createJsonRequest(url: string, body: Record<string, unknown>, method: string = 'POST') {
  return new NextRequest(url, {
    method,
    body: JSON.stringify(body),
  })
}

// Usage:
const req = createJsonRequest('http://localhost:3000/api/membros', { nome: 'John' })
```

**Location:**
- Shared utilities: `src/__tests__/test-utils.ts`
- PDF fixtures: `src/__tests__/pdf/fixtures.ts`
- No `__fixtures__` or `__mocks__` directories

## Coverage

**Requirements:** No enforced minimums. Coverage is opt-in via `npm run test:coverage`.

**Scope:** Coverage is currently scoped to `src/lib/pdf.ts` only (configured in `vitest.config.ts`).

**View Coverage:**
```bash
npm run test:coverage   # Generates text, json, html reports
```

**Coverage Provider:** `@vitest/coverage-v8`

## Test Types

**Unit Tests:**
- All 45+ test files are unit tests
- Mock all external dependencies (DB, auth, external APIs)
- Test individual route handlers, services, schemas, utilities

**Integration Tests:**
- No dedicated integration test suite
- CI runs tests against a real Postgres database in the `db` job (`.github/workflows/ci.yml`)
- Same unit tests run in both `fast` and `db` CI jobs

**E2E Tests:**
- `playwright` is in devDependencies but no test files or config detected
- No E2E test suite currently implemented

## CI/CD Test Pipeline

**GitHub Actions:** `.github/workflows/ci.yml`

**Triggers:** Pull requests and pushes to `main`

**Two parallel jobs:**

1. **`fast` (test-lint-build):**
   - Node 20, no database
   - `npm ci --legacy-peer-deps`
   - `npx prisma generate`
   - `npm run lint`
   - `npm run test:run`
   - `npm run build`

2. **`db`:**
   - Node 20 + PostgreSQL 16 service container
   - `npx prisma migrate deploy` (validates migrations)
   - `npm run test:run`
   - `npm run build`

**Pre-commit Hook:**
- Husky pre-commit runs `npm run test:run` (all tests must pass)
- Configured in `.husky/pre-commit`

**Vercel Build:**
- `vercel-build` script runs `npm run test:run` before `next build`
- Tests gate production deployments

## Common Test Patterns

**Testing API Route Handlers:**
```typescript
import { GET, POST } from '@/app/api/membros/route'

it('should create a new member', async () => {
  vi.mocked(prisma.usuario.findUnique).mockResolvedValue(null)
  vi.mocked(prisma.membro.create).mockResolvedValue({ id: 'membro-123' })

  const req = createJsonRequest('http://localhost:3000/api/membros', { nome: 'John' })
  const res = await POST(req)
  const json = await res.json()

  expect(res.status).toBe(201)
  expect(json.id).toBe('membro-123')
})
```

**Testing Server Actions:**
```typescript
import { toggleMembroStatus } from '@/app/actions/membros'

it('should toggle status', async () => {
  const result = await toggleMembroStatus('123', 'ATIVO')
  expect(prisma.membro.update).toHaveBeenCalledWith({
    where: { id: '123' },
    data: { status: 'INATIVO' },
  })
  expect(result).toEqual({ success: true })
})
```

**Testing Service Functions:**
```typescript
import { listMembros } from '@/services/membro.service'

it('applies status filter', async () => {
  vi.mocked(prisma.membro.findMany).mockResolvedValueOnce([])
  await listMembros({ status: 'ATIVO', compact: true })
  expect(prisma.membro.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { status: 'ATIVO' },
    })
  )
})
```

**Testing Zod Schemas:**
```typescript
import { cadastroSchema } from '@/schemas/auth.schema'

it('rejects invalid email', () => {
  vi.mocked(validarEmail).mockReturnValueOnce(false)
  const result = cadastroSchema.safeParse({ email: 'bad', senha: 'Senha123' })
  expect(result.success).toBe(false)
})
```

**Testing Pure Utilities (no mocks):**
```typescript
import { addDaysYmd, formatBrFromYmd } from '@/lib/dates'

it('adds days to ymd', () => {
  expect(addDaysYmd('2026-02-04', 1)).toBe('2026-02-05')
})
```

**Error Testing:**
```typescript
it('should handle errors gracefully', async () => {
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(prisma.membro.update).mockRejectedValueOnce(new Error('DB Error'))

  const result = await toggleMembroStatus('123', 'ATIVO')

  expect(result).toEqual({ success: false, error: 'Falha ao alterar status' })
  consoleSpy.mockRestore()
})
```

**PDF Generation Testing (output validation):**
```typescript
import { PDFDocument } from 'pdf-lib'
import { generateTrainingPDF } from '@/lib/pdf'

it('generates valid PDF', async () => {
  const pdfBuffer = await generateTrainingPDF(testPDFData)
  expect(pdfBuffer).toBeInstanceOf(Buffer)
  expect(pdfBuffer.length).toBeGreaterThan(500)

  const pdfDoc = await PDFDocument.load(pdfBuffer)
  expect(pdfDoc.getPages().length).toBeGreaterThanOrEqual(1)
})
```

**Dynamic Session Testing:**
```typescript
it('scopes to membroId when session is MEMBRO', async () => {
  sessionRef.current = { user: { role: 'MEMBRO', membroId: 'm-1' } }
  prismaMock.agendamento.findMany.mockResolvedValue([])

  const req = new NextRequest('http://localhost:3000/api/agendamentos?membroId=m-2')
  const res = await GET(req)

  expect(prismaMock.agendamento.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ membroId: 'm-1' }),
    })
  )
})
```

---

*Testing analysis: 2026-02-16*
