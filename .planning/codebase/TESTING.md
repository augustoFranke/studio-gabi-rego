# Testing Patterns

**Analysis Date:** 2026-02-11

## Test Framework

**Runner:**
- Vitest 4.0.17
- Config: `vitest.config.ts`
- Environment: node (not browser)

**Assertion Library:**
- Vitest built-in expect API (compatible with Jest)
- Methods: `expect().toBe()`, `expect().toHaveBeenCalled()`, `expect().toContain()`

**Run Commands:**
```bash
npm run test              # Run tests in watch mode
npm run test:run          # Run all tests once
npm run test:coverage     # Run tests with coverage report
```

## Test File Organization

**Location:**
- Co-located in `src/__tests__/` directory at project root
- Mirrors source structure: `src/__tests__/lib/`, `src/__tests__/api/`, `src/__tests__/schemas/`
- Setup file: `src/__tests__/setup.ts`

**Naming:**
- Test files: `*.test.ts` or `*.test.tsx`
- Spec files: `*.spec.ts` (also recognized)
- Examples:
  - `src/__tests__/lib/dates.test.ts`
  - `src/__tests__/api/membros.test.ts`
  - `src/__tests__/schemas/auth.schema.test.ts`

**Structure:**
```
src/__tests__/
├── setup.ts                           # Global setup, test utils registration
├── test-utils.ts                      # Utility creators for mocking
├── lib/
│   ├── dates.test.ts
│   ├── schedule.test.ts
│   ├── treino-editor.test.ts
│   └── ...
├── api/
│   ├── membros.test.ts
│   ├── agendamentos.test.ts
│   └── ...
└── schemas/
    ├── auth.schema.test.ts
    └── membro.schema.test.ts
```

## Test Structure

**Suite Organization:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Feature name', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should do specific thing', () => {
    // test body
  })

  it('should handle edge case', () => {
    // test body
  })

  describe('Nested feature', () => {
    it('should do nested behavior', () => {
      // test body
    })
  })
})
```

**Patterns:**
- `describe()` blocks organize related tests
- Nested `describe()` for grouped functionality
- `beforeEach()` clears mocks between tests
- Test names start with "should" for unit tests, "GET/POST scopes" for API tests

**Setup:**
- `setup.ts` registers global test utilities in `globalThis.__testUtils`
- Mocks established in hoisted `vi.hoisted()` blocks
- Mocks cleared explicitly in `beforeEach()` hooks

## Mocking

**Framework:** Vitest `vi` module

**Mocking Patterns:**

```typescript
// Hoisted mock setup (runs at module load time)
const { withApiAuthMock, validateRequestMock } = vi.hoisted(() => {
  const { createSessionRef, createValidateRequestMock, mockWithApiAuth } = globalThis.__testUtils
  const sessionRef = createSessionRef({ user: { role: 'ADMIN' } })

  return {
    withApiAuthMock: mockWithApiAuth(sessionRef).withApiAuth,
    validateRequestMock: createValidateRequestMock(),
  }
})

// Mock modules
vi.mock('@/lib/api', () => ({
  withApiAuth: withApiAuthMock,
  validateRequest: validateRequestMock,
}))

// Mock functions
vi.mocked(prisma.usuario.findUnique).mockResolvedValue(result)
```

**Mocking Utilities (from `test-utils.ts`):**

1. **createSessionRef()** - Create mutable session object for tests:
   ```typescript
   const sessionRef = createSessionRef({ user: { role: 'MEMBRO', membroId: 'm-1' } })
   sessionRef.current = { user: { role: 'ADMIN' } } // Change mid-test
   ```

2. **mockWithApiAuth()** - Wrap handler with authentication logic:
   ```typescript
   const mock = mockWithApiAuth(sessionRef).withApiAuth
   // Enforces role checks, calls handler with session
   ```

3. **createPrismaMock()** - Create Prisma mock with specified models/methods:
   ```typescript
   const prismaMock = createPrismaMock({
     membro: ['findUnique', 'create', 'findMany'],
     usuario: ['findUnique', 'create'],
   })
   ```

4. **createValidateRequestMock()** - Mock request validation helper:
   ```typescript
   const validateMock = createValidateRequestMock()
   // Returns vi.fn() that handles JSON parsing and schema validation
   ```

5. **createJsonRequest()** - Create mock NextRequest with JSON body:
   ```typescript
   const req = createJsonRequest('http://localhost:3000/api/membros', { nome: 'John' })
   ```

**What to Mock:**
- External dependencies: Prisma, authentication, email services
- API handlers and middleware
- Request/response objects

**What NOT to Mock:**
- Pure utility functions: date helpers, formatters, validators
- Zod schema validation (use real schemas)
- Business logic helpers

## Fixtures and Factories

**Test Data:**

Factory pattern used in test-utils:

```typescript
export function createSessionRef(initial?: TestSession): SessionRef {
  return {
    current: initial ?? { user: { role: 'ADMIN', membroId: 'm-admin' } },
  }
}

// Usage
const sessionRef = createSessionRef() // Default admin
const sessionRef = createSessionRef({ user: { role: 'MEMBRO', membroId: 'm-1' } })
```

**Location:**
- `src/__tests__/test-utils.ts` - Reusable factory functions
- Factories return mutable objects for test flexibility
- Session reference objects allow mid-test mutations

**Patterns:**
- Default values provided for minimal test setup
- Override specific values as needed
- Factories return objects with clear types

## Coverage

**Requirements:** Selective coverage enabled

**View Coverage:**
```bash
npm run test:coverage
```

**Configured:**
- Provider: v8
- Reporters: text, json, html
- Include: only `src/lib/pdf.ts` (focused coverage target)
- Output: `coverage/` directory with HTML reports

**Coverage Strategy:**
- Not all code requires 100% coverage
- Focus on critical paths: APIs, schemas, utilities
- Libraries like formatters get tested thoroughly
- UI components tested for key behavior

## Test Types

**Unit Tests:**
- Scope: Single function or utility in isolation
- Files: `src/__tests__/lib/*.test.ts`
- Example: `src/__tests__/lib/dates.test.ts`
- Approach: No mocks, test pure functions directly
- Coverage: All branches and edge cases

```typescript
describe('formatTreinoDate', () => {
  it('strips non-digits and auto-inserts slash', () => {
    expect(formatTreinoDate('012025')).toBe('01/2025')
  })

  it('limits to 6 digits', () => {
    expect(formatTreinoDate('0120251234')).toBe('01/2025')
  })
})
```

**Integration Tests:**
- Scope: API routes with mocked dependencies
- Files: `src/__tests__/api/*.test.ts`
- Example: `src/__tests__/api/membros.test.ts`
- Approach: Mock Prisma, validate handler behavior with different inputs
- Coverage: Request validation, role checks, database calls

```typescript
it('should create a new member successfully', async () => {
  // Setup mocks
  vi.mocked(prisma.usuario.findUnique).mockResolvedValue(null)
  vi.mocked(prisma.membro.findUnique).mockResolvedValue(null)
  vi.mocked(prisma.usuario.create).mockResolvedValue(createdUser)
  vi.mocked(prisma.membro.create).mockResolvedValue(createdMember)

  // Create request
  const req = createRequest({ nome: 'John', email: 'john@example.com', ... })
  const res = await POST(req)

  // Assert
  expect(res.status).toBe(201)
  expect(prisma.membro.create).toHaveBeenCalled()
})
```

**Schema Tests:**
- Scope: Zod schema validation with various inputs
- Files: `src/__tests__/schemas/*.test.ts`
- Example: `src/__tests__/schemas/auth.schema.test.ts`
- Approach: Test valid and invalid inputs against schemas
- Coverage: All validation rules

```typescript
describe('cadastroSchema', () => {
  it('cadastroSchema validates email and password rules', () => {
    vi.mocked(validarEmail).mockReturnValueOnce(true)
    const result = cadastroSchema.safeParse({
      email: 'user@example.com',
      senha: 'Senha123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    vi.mocked(validarEmail).mockReturnValueOnce(false)
    const result = cadastroSchema.safeParse({
      email: 'bad-email',
      senha: 'Senha123',
    })
    expect(result.success).toBe(false)
  })
})
```

**E2E Tests:**
- Framework: Not currently used
- Playwright dependency installed but not configured
- Can be added by creating `*.e2e.ts` tests with Playwright

## Common Patterns

**Async Testing:**

```typescript
it('should create member successfully', async () => {
  const res = await POST(req)
  const json = await res.json()

  expect(res.status).toBe(201)
  expect(json.id).toBe('membro-123')
})
```

- All async operations awaited
- Promise mocks: `mockResolvedValue(value)` for success, `mockRejectedValue(error)` for failures

**Error Testing:**

```typescript
it('should return error if email already exists', async () => {
  const existingUser = { id: 'existing' }
  vi.mocked(prisma.usuario.findUnique).mockResolvedValue(existingUser)

  const req = createRequest({ email: 'exists@example.com' })
  const res = await POST(req)
  const json = await res.json()

  expect(res.status).toBe(400)
  expect(json.error).toContain('email já está cadastrado')
})
```

- Test both status codes and error messages
- Use `.toContain()` for substring matching in error messages

**Role-Based Access Testing:**

```typescript
it('GET scopes to membroId when session is MEMBRO', async () => {
  sessionRef.current = { user: { role: 'MEMBRO', membroId: 'm-1' } }

  const res = await GET(req)

  expect(prismaMock.agendamento.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ membroId: 'm-1' }),
    })
  )
})
```

- Mutate sessionRef.current between tests
- Assert that queries are scoped to user's membroId

**Mock Assertion:**

```typescript
expect(prismaMock.agendamento.create).toHaveBeenCalledWith(
  expect.objectContaining({
    data: expect.objectContaining({ membroId: 'm-session', horarioId: 'h-1' }),
  })
)
```

- Use `.toHaveBeenCalledWith()` for exact argument matching
- Use `expect.objectContaining()` for partial object matching
- Verify both that calls were made and with correct parameters

## Test Execution

**Setup Phase:**
1. `setup.ts` registers utilities in `globalThis.__testUtils`
2. Environment set to 'node'
3. Global test helpers (describe, it, expect) available
4. Each test file loads fresh

**Per-Test Phase:**
1. `beforeEach()` clears all mocks
2. Mocks are hoisted (set up once per test file)
3. Mocks can be configured per test
4. Test runs and asserts

**Coverage Report:**
- Generated in `coverage/` directory
- HTML report viewable in browser
- Text report in console

---

*Testing analysis: 2026-02-11*
