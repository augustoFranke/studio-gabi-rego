# Coding Conventions

**Analysis Date:** 2026-02-16

## Language & Type System

**Primary Language:** TypeScript 5.x with strict mode enabled (`tsconfig.json` > `strict: true`)

**Path Alias:** Use `@/*` mapped to `./src/*` for all imports. Never use relative paths that climb out of the current directory.

**Type Patterns:**
- Use `type` keyword for type aliases (not `interface` for data shapes): `export type TrainingPDFData = { ... }` (`src/domain/treino.ts`)
- Use `interface` for component props and API contracts: `interface AlunosFiltersProps { ... }` (`src/components/admin/alunos-filters.tsx`)
- Use `satisfies` for Prisma select/include objects to get type checking while preserving the inferred type: `} satisfies Prisma.MembroSelect` (`src/services/membro.service.ts`)
- Export inferred types from Zod schemas: `export type MembroCreateInput = z.infer<typeof membroCreateSchema>` (`src/schemas/membro.schema.ts`)
- Augment third-party types in `src/types/` directory: `src/types/next-auth.d.ts`

## Naming Patterns

**Files:**
- **Lowercase kebab-case** for all files: `membro.service.ts`, `auth.schema.ts`, `use-mobile.ts`
- **Exception:** React form components use PascalCase: `MemberForm.tsx` (`src/components/forms/MemberForm.tsx`)
- **Schemas:** `{entity}.schema.ts` in `src/schemas/`
- **Services:** `{entity}.service.ts` in `src/services/`
- **Hooks:** `use-{name}.ts` in `src/hooks/`
- **API routes:** `route.ts` inside Next.js App Router directory structure
- **Server Actions:** `{entity}.ts` in `src/app/actions/`
- **Test files:** `{name}.test.ts` in `src/__tests__/{category}/`

**Functions:**
- camelCase for all functions: `listMembros`, `createFichaTreino`, `validateHorarioFixoLimit`
- React components use PascalCase: `MemberForm`, `AlunosFilters`, `ErrorBoundary`
- Server Actions use camelCase: `toggleMembroStatus`, `deleteMembro`
- Exported route handlers use uppercase HTTP methods: `GET`, `POST`, `PATCH`, `DELETE`

**Variables:**
- camelCase for all variables: `sessionRef`, `prismaMock`, `normalizedEmail`
- UPPER_SNAKE_CASE for constants: `MAX_CAPACITY_PER_SLOT`, `MOBILE_BREAKPOINT`, `ADMIN_ROUTES`

**Types:**
- PascalCase for all type/interface names: `SessionUser`, `ScheduleView`, `TrainingPDFData`
- Zod schemas use camelCase: `membroCreateSchema`, `cadastroSchema`, `fichaUpdateSchema`

**Application Domain:** All user-facing text, field names, and error messages are in **Brazilian Portuguese**: `'Membro nao encontrado'`, `'Dados invalidos enviados'`. Variable names are in Portuguese where they mirror the domain: `membroId`, `diaSemana`, `horariosFixos`. Generic programming concepts remain in English: `session`, `handler`, `error`.

## Code Style

**Formatting:**
- No Prettier config detected. Formatting follows IDE defaults / ESLint autofixes.
- 2-space indentation (observed consistently across codebase)
- Single quotes in `.ts` files, double quotes in `.tsx` files (mixed but mostly single in logic files)
- Trailing commas in multiline objects/arrays
- Semicolons omitted in most `.ts` files; present in some `.tsx` files (inconsistent)

**Linting:**
- ESLint 9 with flat config: `eslint.config.mjs`
- Extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- No custom rules beyond Next.js defaults
- Run with: `npm run lint`

## Import Organization

**Order** (observed pattern):
1. External framework imports (`next/server`, `react`, `next/navigation`)
2. External library imports (`zod`, `bcryptjs`, `date-fns`, `sonner`)
3. Internal `@/lib/*` imports
4. Internal `@/components/*` imports
5. Internal `@/schemas/*`, `@/services/*`, `@/hooks/*` imports
6. Relative imports (test utilities)
7. CSS imports last (`./globals.css`)

**Example from** `src/app/api/membros/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth, validateRequest } from '@/lib/api'
import { hash } from 'bcryptjs'
import { validarCPF, validarEmail } from '@/lib/validators'
import { Prisma, StatusMembro } from '@prisma/client'
import { membroCreateSchema } from '@/schemas/membro.schema'
```

**Path Aliases:**
- `@/*` -> `./src/*` (defined in `tsconfig.json` and mirrored in `vitest.config.ts`)

## Component Patterns

**Server Components (default):**
- Page components (`page.tsx`) and layout components (`layout.tsx`) are Server Components by default
- Fetch data directly with Prisma or `auth()`: `src/app/(admin)/dashboard/page.tsx`
- Use `export const dynamic = "force-dynamic"` for pages that need fresh data

**Client Components:**
- Explicitly marked with `"use client"` directive at the top of the file
- Used for interactive elements: forms, filters, sidebars, error boundaries
- Client components live in `src/components/` subdirectories
- Use SWR (`useSWR`) for client-side data fetching with `src/lib/fetcher.ts`

**Server Actions:**
- Marked with `'use server'` directive
- Located in `src/app/actions/`
- Return `{ success: true }` or `{ success: false, error: string }` pattern
- Call `revalidatePath()` after mutations

**UI Component Library:**
- shadcn/ui (new-york style) with Radix UI primitives
- Components in `src/components/ui/` -- these are generated, do not modify directly
- Use `cn()` utility from `src/lib/utils.ts` for conditional class merging
- Icons exclusively from `lucide-react`
- Toasts via `sonner` (`toast()` from `sonner`)

**Form Handling:**
- `react-hook-form` with `zodResolver` for client-side validation
- Zod schemas defined in `src/schemas/` used for both client and server validation
- Form components use shadcn `<Form>`, `<FormField>`, `<FormItem>`, `<FormLabel>`, `<FormMessage>` wrappers

## API Route Patterns

**Authentication Wrapper:**
All API routes use the `withApiAuth()` wrapper from `src/lib/api.ts`:
```typescript
export async function GET(request: NextRequest) {
  return withApiAuth(async (session) => {
    // handler logic
    return NextResponse.json(data)
  }, { requiredRole: 'ADMIN' })
}
```

**Request Validation:**
Use `validateRequest()` from `src/lib/api.ts` with Zod schemas:
```typescript
const validation = await validateRequest(request, membroCreateSchema, {
  invalidJsonMessage: "Dados invalidos enviados.",
  errorMessage: (error) => {
    const issue = error.issues[0]
    return `Erro no campo '${issue.path.join('.')}': ${issue.message}`
  },
})

if ('error' in validation) {
  return validation.error
}

const { nome, email } = validation.data
```

**Error Responses:**
- Always return JSON with `{ error: string }` shape
- Use Portuguese error messages for user-facing errors
- HTTP status codes: 400 (validation), 401 (unauthenticated), 403 (forbidden), 404 (not found), 500 (server error), 503 (unhealthy)

**Dynamic Route Params (Next.js 16):**
Params are async Promises:
```typescript
interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  return withApiAuth(async () => {
    const { id } = await params
    // ...
  })
}
```

**Cron Routes:**
- Authenticated via `CRON_SECRET` bearer token (not session-based)
- Located at `src/app/api/cron/*/route.ts`
- Return summary objects with counts

## Error Handling

**API Routes:**
- `withApiAuth()` wraps handlers in try/catch, logs with `console.error('API Error:', error)`, returns 500
- Specific validation errors return 400 with descriptive Portuguese messages
- Resource not found returns 404

**Server Actions:**
- Wrap in try/catch, return `{ success: false, error: string }` on failure
- Log errors with `console.error('Erro ao ...:', error)`

**Client-Side:**
- `ErrorBoundary` class component in `src/components/error-boundary.tsx` wraps admin layout
- Next.js `error.tsx` at app root provides page-level error UI
- `FetchError` custom class in `src/lib/fetcher.ts` for SWR error handling

**Logging:**
- `console.error()` for all server-side errors
- No structured logging framework
- Development-only error details in responses (e.g., health check)

## State Management

**Server State:**
- SWR for client-side data fetching: `useSWR('/api/membros', fetcher)`
- SWR mutation via `postFetcher` for POST requests
- Server Components fetch directly via Prisma

**Client State:**
- `useState` for local UI state (filters, form values)
- URL search params as state source for filters (`useUrlFilters` hook in `src/hooks/use-url-filters.ts`)
- `react-hook-form` for form state management

**No global state store** (no Redux, Zustand, or Context-based state management beyond ThemeProvider).

## Database Access Patterns

**Prisma Client:**
- Singleton pattern in `src/lib/prisma.ts`
- Always import as `import { prisma } from '@/lib/prisma'`
- Use `satisfies` with `Prisma.*Select` / `Prisma.*Include` for type-safe queries
- Use `$transaction` for multi-step mutations
- Run parallel checks with `Promise.all()` for performance

**Service Layer:**
- `src/services/*.service.ts` encapsulate reusable Prisma queries
- Pure data access -- no auth checks, no HTTP concerns
- API routes call services or use Prisma directly for simple queries

## Validation

**Zod Schemas:**
- Defined in `src/schemas/{entity}.schema.ts`
- Used server-side via `validateRequest()` and client-side via `zodResolver`
- Brazilian-format validation (CPF, phone, dates in DD/MM/YYYY)
- Custom validators in `src/lib/validators.ts` (CPF, email, phone, currency formatting)

## Comments

**When to Comment:**
- JSDoc on validators/utility functions with `@param` and `@returns` (`src/lib/validators.ts`)
- Inline comments for non-obvious business logic (e.g., plan limits, email placeholders)
- Route-level comments describing the endpoint: `// GET /api/membros - Listar todos os membros`
- No comments on self-explanatory code

---

*Convention analysis: 2026-02-16*
