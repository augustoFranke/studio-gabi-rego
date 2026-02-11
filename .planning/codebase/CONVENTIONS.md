# Coding Conventions

**Analysis Date:** 2026-02-11

## Naming Patterns

**Files:**
- Kebab-case for component files: `admin-sidebar.tsx`, `error-boundary.tsx`, `theme-provider.tsx`
- Kebab-case for utility and service files: `test-utils.ts`, `use-schedule.ts`
- Kebab-case for route files: `[id]/route.ts`, `reenviar-verificacao/route.ts`
- Schema files: `membro.schema.ts`, `treino.schema.ts`, `auth.schema.ts`

**Functions:**
- camelCase for function names: `withApiAuth()`, `validateRequest()`, `getYmdInTimeZone()`, `getWeekDays()`
- Public API functions prefixed with verb: `format*`, `parse*`, `get*`, `create*`, `validate*`
- Private helper functions with underscore prefix when needed: `groupByMap()`

**Variables:**
- camelCase for all variables and constants: `currentDate`, `sessionRef`, `membroId`, `isLoading`
- UPPERCASE for module-level constants: `SCHEDULE_START_HOUR`, `SCHEDULE_END_HOUR`, `MAX_CAPACITY_PER_SLOT`
- Portuguese identifiers for domain concepts: `membroId`, `usuarioId`, `diaSemana`, `horaInicio`, `horaFim`

**Types:**
- PascalCase for type names: `SessionUser`, `Session`, `AuthOptions`, `ScheduleEvent`, `DaySchedule`
- Suffix types with descriptive names: `MembroCreateInput`, `MembroUpdateInput`, `MockValidationSchema`
- Interface names start with `I` only for React component props: standard interfaces without prefix
- Export type definitions with `type` keyword: `export type SessionUser = { ... }`

**Exports:**
- Named exports preferred: `export function`, `export const`, `export type`
- Barrel files used to organize exports: `src/__tests__/test-utils.ts` exports all test utilities
- Path aliases for imports: `@/*` maps to `./src/*` (configured in tsconfig.json)

## Code Style

**Formatting:**
- 2-space indentation (Next.js default)
- Double quotes for strings: `"use client"`, `'@/lib/api'`
- Mixed quotes: single for template strings and dynamic content, double for JSX attributes
- Line length: flexible, no strict limit enforced
- No semicolons at end of statements (configured via ESLint)

**Linting:**
- ESLint with Next.js config (v9) and Core Web Vitals rules
- Config file: `eslint.config.mjs`
- TypeScript strict mode enabled
- Extensions: `js`, `jsx`, `ts`, `tsx`, `mjs`

**TypeScript:**
- Target: ES2017
- Strict mode enabled: `"strict": true`
- JSX mode: react-jsx
- Module resolution: bundler
- Type-checking config: `tsconfig.typecheck.json`

## Import Organization

**Order:**
1. External libraries: `import { z } from 'zod'`, `import { NextRequest } from 'next/server'`
2. Internal utilities and lib: `import { prisma } from '@/lib/prisma'`, `import { withApiAuth } from '@/lib/api'`
3. Components and types: `import { Avatar } from '@/components/ui/avatar'`, `import type { Session } from '@/lib/api'`
4. Test utilities (in test files): `import { createSessionRef } from '@/__tests__/test-utils'`

**Path Aliases:**
- `@/*` - Primary alias pointing to `./src/`
- Used consistently across all imports
- Example: `@/lib/api`, `@/schemas/auth.schema`, `@/components/ui/card`

**Import Grouping:**
- Separate external from internal with blank line
- Use `type` keyword for type-only imports: `import type { ScheduleEvent } from '@/types/schedule'`
- Wildcard imports for utilities: `import * as React from "react"`

## Error Handling

**Patterns:**
- Throw errors from handlers: `throw new Error(payload?.error || 'Erro ao salvar perfil')`
- API handlers return NextResponse: `NextResponse.json({ error: 'message' }, { status: 400 })`
- Schema validation returns `{ data: T } | { error: NextResponse }`
- Hooks throw errors that get caught in error boundaries or component try-catch
- API helper `validateRequest()` catches JSON parsing and schema validation errors

**Error Messages:**
- Portuguese error messages for user-facing errors
- Descriptive messages with context: `'Não há vagas disponíveis'`, `'Este CPF já está cadastrado para outro membro.'`
- Field-specific error messages: `error` field in validation results

**Try-Catch:**
- Used in API routes to wrap handler execution
- Used in server actions: `app/actions/membros.ts` wraps Prisma operations
- Used in client hooks: `useSchedule` catches API errors and shows toast notifications

## Logging

**Framework:** console (console.log, console.error, console.warn)

**Patterns:**
- `console.error()` for error logging: `console.error('API Error:', error)`
- `console.warn()` for warnings: `console.warn("Resend não configurado - envio de email ignorado.")`
- Location: API routes, server actions, error boundaries
- No structured logging library used

**When to Log:**
- Errors in try-catch blocks
- Configuration warnings (missing env vars)
- Not in normal control flow

## Comments

**When to Comment:**
- Complex business logic: date calculations, timezone handling
- Non-obvious algorithm explanations
- Function purpose and limitations

**Inline Comments:**
- Single-line: `// Get DiaSemana from JavaScript day number (0 = Sunday)`
- Explain "why" not "what": code should be self-explanatory, comments explain rationale

**JSDoc/TSDoc:**
- Used for public utility functions with complex parameters
- Example in `dates.ts`:
  ```typescript
  /**
   * Format input as MM/AAAA (treino date format)
   * Auto-inserts slash after 2 digits
   */
  export function formatTreinoDate(value: string): string
  ```
- Optional for straightforward functions
- Documents: purpose, parameter meanings, return values

## Function Design

**Size:**
- Small, focused functions preferred
- Average 15-40 lines for utilities
- API handlers can be longer (~100 lines) due to validation and business logic

**Parameters:**
- Named parameters preferred for functions with multiple options
- Use object parameters for config: `interface ApiOptions { requireAuth?: boolean; requiredRole?: Role }`
- Type safety required: all parameters and returns typed

**Return Values:**
- Explicit return types: `Promise<NextResponse>`, `ValidationResult<T>`, `Map<string, T[]>`
- Discriminated unions for result types: `{ data: T } | { error: NextResponse }`
- Generic types for reusable patterns: `<T>` in utility functions

**Async/Await:**
- Async/await preferred over .then() chains
- Sequential operations use await
- Parallel operations use Promise.all: `await Promise.all([check1, check2, check3])`

## Module Design

**Exports:**
- Default exports avoided
- Named exports for functions and types
- Each module exports a cohesive set of related functions
- Example: `lib/dates.ts` exports all date helpers together

**Barrel Files:**
- `src/__tests__/test-utils.ts` - Exports all test utility creators
- Not used for src/lib or components (direct imports preferred)

**Dependencies:**
- Lib modules depend on external libraries and database layer
- API handlers depend on lib and schemas
- Components depend on lib, hooks, and UI components
- Circular dependencies avoided

## Validation

**Schema Validation:**
- Zod for schema definition: `z.object()`, `z.string()`, `z.enum()`
- Custom refinements for complex rules: `.superRefine()` or chained validators
- Type inference: `export type MembroCreateInput = z.infer<typeof membroCreateSchema>`
- Server-side validators: `validarEmail()`, `validarCPF()` from `@/lib/validators`

**Request Validation:**
- Use `validateRequest()` helper in API routes
- Schema parameter and optional error message formatter
- Returns `{ data: T } | { error: NextResponse }` discriminated union
- Handles JSON parsing errors before schema validation

## Security Patterns

**Authentication:**
- NextAuth for session management
- `withApiAuth()` helper enforces authentication on API routes
- Role-based access control: `requiredRole: 'ADMIN'` option
- `ensureOwnerOrAdmin()` for resource ownership checks

**Data Access:**
- Email normalized to lowercase before queries
- CPF cleaned (remove non-digits) before queries
- Password hashed with bcryptjs: `await hash(password, 12)`

---

*Convention analysis: 2026-02-11*
