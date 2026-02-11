# Architecture

**Analysis Date:** 2026-02-11

## Pattern Overview

**Overall:** Next.js 16 full-stack application with role-based access control (RBAC), organized as a monolithic SPA with separate admin and member interfaces.

**Key Characteristics:**
- **Framework:** Next.js App Router with server components and server actions for seamless data mutations
- **Authentication:** Next-Auth v5 with JWT-based session strategy and credential-based login
- **Authorization:** Middleware-enforced route protection with role-based checks (ADMIN, MEMBRO)
- **Data Layer:** Prisma ORM with PostgreSQL backend
- **UI Framework:** React 19 with Radix UI component primitives and Tailwind CSS styling
- **Real-time Features:** SWR for client-side data fetching with automatic revalidation

## Layers

**API Layer (`src/app/api/`):**
- Purpose: RESTful API endpoints for data operations, cron jobs, and webhooks
- Location: `src/app/api/`
- Contains: Route handlers (route.ts), NextAuth providers, background job endpoints
- Depends on: Services layer, Prisma, Auth system
- Used by: Frontend pages, external services (webhooks), scheduled tasks

**Service Layer (`src/services/`):**
- Purpose: Business logic encapsulation for recurring patterns (member management, scheduling, training)
- Location: `src/services/`
- Contains: Functions like `listMembros()`, `getMembroById()`, query builders for complex operations
- Depends on: Prisma, database models, external integrations
- Used by: API routes, server actions, pages

**Library Layer (`src/lib/`):**
- Purpose: Utilities, helpers, and infrastructure code (auth, database, validation, payments, email, scheduling)
- Location: `src/lib/`
- Contains: Prisma singleton, auth configuration, rate limiting, PDF generation, scheduler tasks, WhatsApp integration
- Depends on: External SDKs (Resend, Upstash, Evolution API), Prisma
- Used by: Services, API routes, pages, components

**UI Component Layer (`src/components/`):**
- Purpose: Reusable React components for consistent UI patterns
- Location: `src/components/`
- Contains: Radix UI primitives (`ui/`), admin/member-specific components (`admin/`, `forms/`, `schedule/`)
- Depends on: React, Tailwind CSS, client-side hooks
- Used by: Page layouts and route pages

**Page Layer (`src/app/`):**
- Purpose: Server-rendered pages and layouts using Next.js App Router groups
- Location: `src/app/`
- Contains: Grouped routes for `(admin)`, `(aluno)`, and `(auth)` roles; shared actions in `actions/`
- Depends on: Components, services, auth, Prisma
- Used by: Next.js router

**Domain & Schema Layer (`src/domain/`, `src/schemas/`):**
- Purpose: Type definitions for business entities and Zod validation schemas
- Location: `src/domain/`, `src/schemas/`
- Contains: Training exercise types, member schemas, auth schemas
- Depends on: Zod
- Used by: Services, API routes, form validation

**Middleware (`src/middleware.ts`):**
- Purpose: Request-level route protection and role-based access control
- Location: `src/middleware.ts`
- Protects: Admin routes, member routes, and public routes
- Checks: User session token, role verification before page render

## Data Flow

**User Login Flow:**

1. User submits credentials to `/api/auth/[...nextauth]` handler
2. NextAuth provider validates credentials against `Usuario` in database via bcryptjs
3. JWT token created with user ID, role, and membroId
4. Token stored in httpOnly cookie (production) or session cookie (development)
5. Session available via `auth()` helper across the app

**Page Load with Auth:**

1. Middleware intercepts request, reads JWT token from cookies
2. Middleware checks route against role requirements (ADMIN_ROUTES, MEMBER_ROUTES, PUBLIC_ROUTES)
3. If protected route, validates role matches requirement, redirects if unauthorized
4. Layout component calls `auth()` to ensure session exists before rendering children
5. Page can access session data to populate UI

**Data Mutation (Server Actions):**

1. Component calls server action (e.g., `toggleMembroStatus()` from `src/app/actions/membros.ts`)
2. Server action executes with `'use server'` directive
3. Calls Prisma to update database
4. Calls `revalidatePath()` to purge cached page data
5. Client receives updated state, UI refreshes

**API Route Data Flow:**

1. Client makes request to `/api/{resource}` (e.g., `/api/membros?status=ATIVO`)
2. Route handler wrapped with `withApiAuth()` helper to enforce authentication and authorization
3. If authenticated and authorized, handler executes query logic using services or Prisma directly
4. Returns JSON response with status code (200, 401, 403, 500)

**Scheduled Tasks (Cron):**

1. External service (Vercel Cron, Upstash) calls `/api/cron/{job-name}` at configured interval
2. Cron handler authenticates with `CRON_TOKEN` env var for security
3. Executes background jobs: email notifications, payment reminders, schedule syncing
4. Batches database operations for performance, rate-limits external API calls

**State Management:**

- **Server State:** Prisma database queries cached via Next.js `unstable_cache` and route-level ISR
- **Client State:** SWR hooks for polling external data, React state for form inputs and UI toggles
- **Session State:** JWT token in cookie, derived session object passed to components
- **Cache Invalidation:** `revalidatePath()` after mutations, manual revalidation in SWR hooks

## Key Abstractions

**withApiAuth Helper:**
- Purpose: Encapsulates auth/authz logic for API routes
- File: `src/lib/api.ts`
- Pattern: Wraps route handler, validates session, checks role before calling handler
- Example: Used in `src/app/api/membros/route.ts` for GET/POST

**Prisma Singleton:**
- Purpose: Single database connection instance across server, prevents connection pool exhaustion
- File: `src/lib/prisma.ts`
- Pattern: Global singleton with conditional assignment in development
- Code: `globalForPrisma.prisma ?? new PrismaClient()`

**Service Functions (e.g., membro.service.ts):**
- Purpose: Reusable query builders for complex or repeated database operations
- File: `src/services/membro.service.ts`
- Pattern: Async functions accepting filter parameters, returning typed results
- Example: `listMembros({ status, compact })` with conditional projections

**Role-Based Middleware:**
- Purpose: Route protection before page render
- File: `src/middleware.ts`
- Pattern: Defines route groups, validates token, redirects unauthorized access
- Flexible: Routes defined as arrays, easily extendable

**Schedule Components (Agenda):**
- Purpose: Reusable calendar/scheduling UI for member and admin views
- Files: `src/components/schedule/` (daily-view, weekly-view, monthly-view, time-slot.tsx)
- Pattern: Controlled components using `use-schedule` hook for state management
- Data: Fetched via SWR from `/api/agendamentos`

**Notification Processing:**
- Purpose: Batch processing of notifications with deduplication and rate limiting
- File: `src/lib/scheduler.ts`
- Pattern: Generic `processNotifications()` function with pluggable email/WhatsApp senders
- Performance: Single query for deduplication, parallel batches (5 at a time)

## Entry Points

**Web Application (`src/app/layout.tsx`):**
- Location: `src/app/layout.tsx`
- Triggers: Browser navigation to `/`
- Responsibilities: Sets up theme provider, notification toaster, child route rendering

**Admin Panel (`src/app/(admin)/layout.tsx`):**
- Location: `src/app/(admin)/layout.tsx`
- Triggers: Authenticated ADMIN role navigating to `/dashboard`, `/alunos`, etc.
- Responsibilities: Renders sidebar, header with theme toggle, validates admin role before rendering

**Member Interface (`src/app/(aluno)/layout.tsx`):**
- Location: `src/app/(aluno)/layout.tsx`
- Triggers: Authenticated MEMBRO role navigating to `/inicio`, `/meu-treino`, etc.
- Responsibilities: Renders member-specific sidebar, ensures MEMBRO or ADMIN role

**Auth Routes (`src/app/(auth)/layout.tsx`):**
- Location: `src/app/(auth)/layout.tsx`
- Triggers: Unauthenticated users navigating to `/login`, `/cadastro`, etc.
- Responsibilities: Renders login/signup forms, redirects authenticated users to role-based dashboard

**API Routes:**
- `/api/auth/[...nextauth]` - NextAuth provider endpoints for sign-in, sign-out, session
- `/api/membros` - Member CRUD and listing
- `/api/agendamentos` - Schedule/appointment management
- `/api/treinos` - Training program creation and PDF generation
- `/api/cron/{job}` - Scheduled background tasks
- `/api/health` - Health check endpoint

## Error Handling

**Strategy:** Try-catch in route handlers with generic error responses in production, detailed errors in development

**Patterns:**

- **API Errors:** Route handlers return `NextResponse.json({ error: message }, { status: code })`
- **Auth Errors:** Middleware redirects to `/login` on auth failure, returns 401/403 on API calls
- **Validation Errors:** Zod schema validation in route handlers, returns error details from ZodError
- **Database Errors:** Prisma errors caught in try-catch, logged to console, generic error returned to client
- **Server Action Errors:** Wrapped in try-catch, return `{ success: false, error: message }` object

**Components:** Error boundary component (`src/components/error-boundary.tsx`) catches React errors in subtrees

## Cross-Cutting Concerns

**Logging:**
- Development: Prisma logs queries, errors, and warnings via `log` config
- API routes: Console.error on failures
- No centralized logging service detected; relies on platform logs (Vercel, Docker stderr)

**Validation:**
- Client-side: React Hook Form with Zod schema integration
- Server-side: Zod schema validation in API routes before processing
- File: `src/lib/validators.ts` contains utility functions (formatarData, formatarMoeda, etc.)
- Schemas: `src/schemas/` contains auth, membro, treino schemas

**Authentication:**
- Provider: NextAuth v5 with Credentials provider
- Session strategy: JWT (stateless)
- Cookie names vary by environment (production: `__Secure-authjs.session-token`)
- User roles: ADMIN, MEMBRO
- Caching: `React.cache()` wraps auth() to deduplicate requests in single render cycle

**Rate Limiting:**
- File: `src/lib/rate-limit.ts`
- Provider: Upstash Redis
- Used by: Cron endpoints to throttle external API calls (batches of 5)

**Security:**
- CORS headers configured per `next.config.ts` with origin validation
- Security headers: X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security
- Credential validation: bcryptjs for password hashing/comparison
- CSRF: NextAuth handles via token mechanism
- Email sanitization: Anamnese input sanitized with DOMPurify

---

*Architecture analysis: 2026-02-11*
