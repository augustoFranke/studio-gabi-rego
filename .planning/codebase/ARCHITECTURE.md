# Architecture

**Analysis Date:** 2026-02-16

## Pattern Overview

**Overall:** Next.js App Router Monolith with Role-Based Multi-Tenant UI

**Key Characteristics:**
- Full-stack Next.js 16 application using the App Router with React Server Components
- Two distinct UI shells: Admin (`(admin)`) and Student/Member (`(aluno)`) via route groups
- API routes serve as the backend, accessed by both server components (direct Prisma) and client components (via SWR + fetch)
- Credential-based authentication with JWT sessions (NextAuth v5 beta)
- PostgreSQL database accessed exclusively through Prisma ORM
- Brazilian Portuguese domain language throughout: "membro" (member), "aluno" (student), "treino" (training), "agendamento" (appointment), "pagamento" (payment)

## Layers

**Presentation Layer (UI):**
- Purpose: Render pages and handle user interactions
- Location: `src/app/(admin)/`, `src/app/(aluno)/`, `src/app/(auth)/`
- Contains: Page components (RSC and client), layout shells, route-group-level auth guards
- Depends on: API routes (via SWR/fetch from client components), Prisma (direct from server components), `src/components/`, `src/hooks/`
- Used by: End users (admin and members)

**API Layer:**
- Purpose: RESTful endpoints for CRUD operations and background jobs
- Location: `src/app/api/`
- Contains: Route handlers (GET, POST, PUT, PATCH, DELETE) following Next.js App Router conventions
- Depends on: `src/lib/api.ts` (auth wrapper, validation), `src/services/` (business logic), `src/schemas/` (Zod validation), `src/lib/prisma.ts` (database)
- Used by: Client-side hooks (SWR), external cron triggers (Vercel Cron)

**Service Layer:**
- Purpose: Encapsulate complex business logic and multi-step database operations
- Location: `src/services/`
- Contains: `membro.service.ts`, `treino.service.ts`, `agendamento.service.ts`
- Depends on: `src/lib/prisma.ts`, `src/schemas/`, `src/lib/schedule.ts`
- Used by: API routes, Server Actions, Scheduler jobs

**Domain Layer:**
- Purpose: Type definitions for core domain concepts
- Location: `src/domain/`
- Contains: `treino.ts` (training-related types: TreinoFicha, TreinoExercise, TrainingPDFData)
- Depends on: Nothing (pure types)
- Used by: Services, API routes, PDF generator

**Schema Layer (Validation):**
- Purpose: Zod schemas for request validation and type inference
- Location: `src/schemas/`
- Contains: `auth.schema.ts`, `membro.schema.ts`, `treino.schema.ts`
- Depends on: Zod
- Used by: API routes via `validateRequest()`, type exports used across layers

**Library Layer:**
- Purpose: Shared utilities, clients, and cross-cutting infrastructure
- Location: `src/lib/`
- Contains: Auth config, Prisma client, email/WhatsApp clients, PDF generation, date helpers, validators, rate limiting, schedule logic
- Depends on: External services (Resend, Evolution API, Upstash Redis), Prisma
- Used by: All other layers

**Server Actions Layer:**
- Purpose: Server-side mutations callable from client components
- Location: `src/app/actions/`
- Contains: `membros.ts` (toggleMembroStatus, deleteMembro, deactivateMembro)
- Depends on: `src/lib/prisma.ts`
- Used by: Client components via `'use server'` directive

**Background Jobs Layer:**
- Purpose: Scheduled tasks triggered by external cron
- Location: `src/lib/scheduler.ts`, `src/lib/jobs/`, `src/app/api/cron/`
- Contains: Payment reminders (WhatsApp), class reminders (email), birthday notifications, overdue payment updates, recurring appointment generation
- Depends on: Prisma, Resend (email), Evolution API (WhatsApp)
- Used by: Vercel Cron Jobs via API endpoints (`/api/cron/cobrancas-whatsapp`, `/api/cron/tarefas-email`)

## Data Flow

**Authenticated API Request (Client Component):**

1. Client component calls SWR hook (e.g., `useSchedule` in `src/hooks/use-schedule.ts`) which fetches `/api/agendamentos?dataInicio=...&dataFim=...`
2. `src/lib/fetcher.ts` makes the HTTP request with error handling
3. API route handler in `src/app/api/agendamentos/route.ts` calls `withApiAuth()` from `src/lib/api.ts`
4. `withApiAuth()` calls `auth()` from `src/lib/auth.ts` which verifies the JWT session
5. If authorized, handler executes business logic (may call services or Prisma directly)
6. Response returns JSON to SWR which caches it client-side

**Authenticated Page Load (Server Component):**

1. User navigates to a route (e.g., `/alunos`)
2. `src/middleware.ts` runs first: checks JWT token via `getToken()`, enforces role-based access (ADMIN routes vs MEMBRO routes)
3. Route group layout (e.g., `src/app/(admin)/layout.tsx`) calls `auth()` server-side for double-check, renders sidebar shell
4. Page component (e.g., `src/app/(admin)/alunos/page.tsx`) fetches data directly from Prisma or API
5. Server-rendered HTML returned to client

**Cron Job Execution:**

1. Vercel Cron triggers POST to `/api/cron/cobrancas-whatsapp` or `/api/cron/tarefas-email`
2. Route handler verifies `CRON_SECRET` bearer token from `Authorization` header
3. Job function queries Prisma for pending items, sends notifications via WhatsApp (Evolution API) or Email (Resend)
4. Creates/updates `Notificacao` records to prevent duplicate sends
5. Returns summary JSON with sent/skipped/failed counts

**State Management:**
- Server state: SWR (`swr` v2) for client-side data fetching with automatic caching and revalidation
- Form state: `react-hook-form` with `@hookform/resolvers` + Zod for validation
- UI state: React `useState`/`useCallback` in custom hooks (`src/hooks/`)
- URL state: `src/hooks/use-url-filters.ts` for filter persistence in query params
- Theme: `next-themes` for dark/light mode
- No global client-side state store (no Redux, Zustand, etc.)

## Key Abstractions

**`withApiAuth()` - API Authentication Wrapper:**
- Purpose: Standardized auth guard for all API routes
- Location: `src/lib/api.ts`
- Pattern: Higher-order function that wraps route handlers, injects typed session
- Supports: Required auth (default), optional auth (`requireAuth: false`), role-based (`requiredRole: 'ADMIN'`)
- Example: `return withApiAuth(async (session) => { ... }, { requiredRole: 'ADMIN' })`

**`validateRequest()` - Request Validation:**
- Purpose: Parse and validate request body against Zod schema
- Location: `src/lib/api.ts`
- Pattern: Returns discriminated union `{ data: T } | { error: NextResponse }`, caller checks with `'error' in validation`
- Example: `const validation = await validateRequest(request, membroCreateSchema); if ('error' in validation) return validation.error;`

**`ensureOwnerOrAdmin()` - Ownership Check:**
- Purpose: Verify that a MEMBRO user can only access their own resources
- Location: `src/lib/api.ts`
- Pattern: Returns `NextResponse` (forbidden) or `null` (allowed)

**Recurring Schedule Sync:**
- Purpose: Auto-generate `Agendamento` records from `HorarioFixo` (fixed weekly schedules)
- Location: `src/services/agendamento.service.ts` (`syncAgendamentosRecorrentes`)
- Pattern: Lazily called when fetching agendamentos for a date range that includes today or future. Creates missing time slots (`HorarioDisponivel`) and `Agendamento` records, respecting slot capacity.

**PDF Generation:**
- Purpose: Generate A4 training sheets (fichas de treino) as PDF
- Location: `src/lib/pdf.ts`
- Pattern: Uses PDFKit with custom font (FreeStyleScript embedded as base64 in `src/lib/fonts/FreeStyleScript.base64.ts`), generates Buffer that API returns as file download

## Entry Points

**Root Page (`/`):**
- Location: `src/app/page.tsx`
- Triggers: Direct URL access
- Responsibilities: Auth check, onboarding routing. Redirects ADMIN to `/dashboard`, MEMBRO to `/inicio` (or onboarding pages if incomplete)

**Middleware:**
- Location: `src/middleware.ts`
- Triggers: Every matched request (excludes static assets)
- Responsibilities: JWT verification, role-based route protection. Defines three route categories: PUBLIC_ROUTES (no auth), ADMIN_ROUTES (ADMIN role only), MEMBER_ROUTES (MEMBRO or ADMIN)

**NextAuth Handler:**
- Location: `src/app/api/auth/[...nextauth]/route.ts`
- Triggers: Auth API calls (sign in, sign out, session)
- Responsibilities: Delegates to NextAuth config in `src/lib/auth.ts`

**Instrumentation:**
- Location: `src/instrumentation.ts`
- Triggers: Server startup (Node.js runtime only)
- Responsibilities: Registers graceful shutdown handlers for Prisma disconnect

## API Route Organization

**Auth (`/api/auth/`):**
- `[...nextauth]/route.ts` - NextAuth catch-all handler
- `cadastro/route.ts` - POST: User registration with email verification
- `verificar-email/route.ts` - POST: Email token verification
- `reenviar-verificacao/route.ts` - POST: Resend verification email
- `enviar-reset-senha/route.ts` - POST: Send password reset email
- `validar-token-reset/route.ts` - POST: Validate reset token
- `redefinir-senha/route.ts` - POST: Set new password

**Members (`/api/membros/`):**
- `route.ts` - GET: List members (ADMIN), POST: Create member (ADMIN)
- `[id]/route.ts` - GET/PUT/DELETE: Single member CRUD (ADMIN)
- `[id]/anamnese/route.ts` - GET/PUT: Member anamnese (health questionnaire)
- `[id]/anamnese-link/route.ts` - POST: Generate anamnese token link

**Scheduling (`/api/agendamentos/`, `/api/horarios/`):**
- `agendamentos/route.ts` - GET: List (with auto-sync of recurring), POST: Create
- `agendamentos/[id]/route.ts` - GET/PATCH/DELETE: Single appointment
- `horarios/route.ts` - GET: List available time slots
- `horarios/get-or-create/route.ts` - POST: Get or create a time slot

**Training (`/api/treinos/`):**
- `route.ts` - GET: List training sheets, POST: Create
- `[id]/route.ts` - GET/PUT/DELETE: Single training sheet
- `[id]/pdf/route.ts` - GET: Generate PDF for existing training sheet
- `gerar-pdf/route.ts` - POST: Generate PDF from arbitrary data
- `templates/route.ts` - GET/POST: Training templates

**Financial (`/api/pagamentos/`, `/api/financeiro/`, `/api/planos/`):**
- `pagamentos/route.ts` - GET/POST: Payment CRUD
- `pagamentos/[id]/route.ts` - GET/PATCH/DELETE: Single payment
- `financeiro/stats/route.ts` - GET: Financial statistics
- `planos/route.ts` - GET/POST: Plan CRUD
- `planos/[id]/route.ts` - GET/PUT/DELETE: Single plan

**Other:**
- `perfil/route.ts` - GET/PUT: Current user profile
- `minha-anamnese/route.ts` - GET/PUT: Current member's anamnese
- `notificacoes/route.ts` - GET: List notifications
- `configuracoes/route.ts` - GET/PUT: System settings
- `anamnese-token/route.ts` - POST: Validate anamnese token (public)
- `health/route.ts` - GET: Health check
- `cron/cobrancas-whatsapp/route.ts` - POST: WhatsApp payment reminders (cron)
- `cron/tarefas-email/route.ts` - POST: Email tasks (cron)

## Error Handling

**Strategy:** Per-layer error handling with consistent JSON error responses

**Patterns:**
- API routes: `withApiAuth()` wraps handlers in try/catch, returns `{ error: string }` with appropriate HTTP status. Unhandled errors return 500 with "Erro interno do servidor"
- Validation: `validateRequest()` returns structured validation errors from Zod, first issue message surfaced to user
- Client-side: SWR `FetchError` class (`src/lib/fetcher.ts`) captures HTTP status and response body. Hooks show `toast.error()` via Sonner
- Server Actions: Return `{ success: boolean, error?: string }` pattern
- Error Boundary: `src/components/error-boundary.tsx` wraps admin layout for React error catching

## Cross-Cutting Concerns

**Logging:** `console.error` / `console.warn` throughout. No structured logging library. Prisma logs queries in development mode.

**Validation:** Zod schemas in `src/schemas/` for request bodies. Brazilian-specific validators in `src/lib/validators.ts` (CPF, email, phone, currency). Anamnese field whitelist in `src/lib/anamnese.ts`.

**Authentication:** NextAuth v5 (beta) with Credentials provider. JWT strategy with 24h session TTL. Middleware enforces route-level access. `withApiAuth()` enforces API-level access. Session cached per-request via `React.cache()`.

**Authorization:** Two roles: ADMIN and MEMBRO. Middleware prevents cross-role route access. API `withApiAuth({ requiredRole: 'ADMIN' })` enforces role. `ensureOwnerOrAdmin()` prevents members from accessing other members' data.

**Rate Limiting:** Upstash Redis-backed sliding window (5 requests/minute) via `src/lib/rate-limit.ts`. Applied to auth endpoints (registration, password reset). Fails open if Redis not configured (with production warning).

**Security Headers:** Set in `next.config.ts`: X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, HSTS (production only). CORS headers on `/api/*` routes.

---

*Architecture analysis: 2026-02-16*
