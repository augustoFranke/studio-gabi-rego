# ARCHITECTURE

## System Overview
The system is a single Next.js App Router application that serves:
- Admin web flows (`(admin)` routes)
- Member web flows (`(aluno)` routes)
- Auth/onboarding flows (`(auth)` routes)
- JSON API routes under `src/app/api/**`

It uses Prisma for all persistence, NextAuth credentials-based login with JWT sessions, and middleware/API wrappers for authorization boundaries.

## Component Interaction Model
- Browser requests page routes.
- `src/middleware.ts` performs route-level session/role checks before render.
- Server components/layouts call `auth()` (`src/lib/auth.ts`) for session-aware rendering.
- Client components fetch APIs through `fetch`/SWR (`src/lib/fetcher.ts`).
- API handlers are typically wrapped by `withApiAuth` (`src/lib/api.ts`) and call Prisma or service-layer helpers.
- Background jobs are triggered through protected cron endpoints and execute scheduler/job modules.

## UI Selection Pattern
- Dynamic/high-cardinality selectors use searchable comboboxes (`SearchableSelect`) for in-dropdown filtering.
- Data-driven selector options are rendered in `pt-BR` alphabetical order to keep behavior consistent across admin/member surfaces.
- Semantic/fixed enum selectors intentionally keep business order instead of forced alphabetical ordering.

## Data Flow
### Request Lifecycle (Typical Protected Resource)
1. Request hits middleware and is route-classified (`PUBLIC_ROUTES`, `ADMIN_ROUTES`, `MEMBER_ROUTES`).
2. Middleware reads JWT cookie via `next-auth/jwt` and redirects on mismatch.
3. API request enters `route.ts`; `withApiAuth` validates session and optional role.
4. Request body is schema-validated (Zod) where applicable.
5. Handler executes Prisma queries directly or via `src/services/*`.
6. JSON response returns domain-specific payload/errors.

### Scheduling Lifecycle
- Admin creates slot booking via `/api/agendamentos`.
- Weekly recurrence optionally creates `horarios_fixos`.
- Read paths call `syncAgendamentosRecorrentes` to materialize future bookings for active members within requested ranges.

### Notification Lifecycle
- Cron endpoints require Bearer `CRON_SECRET`.
- Scheduler composes reminder candidates, deduplicates by `notificacoes`, sends via email/WhatsApp when configured, and marks notifications sent.

### Payment Import Lifecycle
- Utility CLI parses DOCX rows, scores member-name matches, and runs dry-run or apply mode.
- Apply mode writes `pagamentos`, `pagamento_import_runs`, and `pagamento_import_logs` with idempotency via `import_key`.
- Rollback deletes imported payments by run and marks run rolled back.

## Persistence
## Database And ORM
- DB: PostgreSQL (`provider = "postgresql"`)
- ORM: Prisma (`prisma/schema.prisma`)
- Runtime URL: `DATABASE_URL`
- Migration URL: `DIRECT_URL`

## Core Data Domains
- Identity/access: `Usuario`, `Role`
- Member profile: `Membro`, `Anamnese`, onboarding token fields
- Scheduling: `HorarioDisponivel`, `HorarioFixo`, `Agendamento`
- Training: `FichaTreino`, `Exercicio`, `TreinoTemplate`, `TreinoTemplateExercicio`
- Finance: `Plano`, `Pagamento`, `StatusPagamento`
- Messaging: `Notificacao`, `TipoNotificacao`
- Import audit: `PagamentoImportRun`, `PagamentoImportLog`

## Migrations
- Baseline domain schema: `prisma/migrations/20250309120000_init/migration.sql`
- Fixed-slot recurrence: `20260128130000_add_horarios_fixos`
- Supabase RLS enablement: `20260127120000_enable_rls_public`
- Payment import audit tables/enums: `20260223103841_add_pagamento_import_audit`

## AuthN / AuthZ
## Authentication
- NextAuth credentials provider (`src/lib/auth.ts`) validates:
  - Existing user
  - Verified email
  - Password-set state
  - bcrypt password match
- Session strategy: JWT (`session.strategy = "jwt"`, 24h max age)

## Authorization
- Middleware route gating by role.
- API role gating with `withApiAuth(..., { requiredRole })`.
- Ownership enforcement on per-resource reads (`ensureOwnerOrAdmin`) for member-owned records (payments, training plans, bookings).

## External Integrations
- Resend email API (`src/lib/resend.ts`)
- Evolution WhatsApp API (`src/lib/whatsapp/evolution.ts`)
- Upstash Redis ratelimiting (`src/lib/rate-limit.ts`)
- Supabase Postgres (inferred from env templates/AGENTS operational notes)

## Observability
- Logging: `console.error` / `console.warn` patterns in handlers/jobs.
- Health endpoint: `/api/health` checks DB connectivity via `SELECT 1`.
- No in-repo metrics/tracing backend exporter configuration beyond runtime instrumentation hook (`src/instrumentation.ts` registering shutdown handlers).

## Deployment And Runtime Topology
## Vercel Path
- `vercel.json` uses `npm run vercel-build`.
- `vercel-build` script runs Prisma generate, optional migration deploy, tests, then Next build.

## Docker Path
- Multi-stage Dockerfile builds standalone Next output and ships Prisma runtime assets.
- `docker-compose.yml` defines app + postgres, health checks, and network wiring.

## CI
- `.github/workflows/ci.yml` runs:
  - lint/test/build fast job
  - DB-backed job with migration deploy validation and tests

## Key Tradeoffs And Risks
- **JWT sessions over DB sessions**: simpler stateless scaling, but revocation/instant invalidation is harder.
- **Fail-open rate limiting**: production logs critical warning but still allows requests if Upstash is not configured.
- **Hard deletes in some flows**: member/account cascade delete and schedule deletions prioritize simplicity over retention/audit recovery.
- **Cron endpoint trigger model**: secure token checks exist, but trigger scheduling source is external to repo.
- **Monolith page complexity**: some admin/auth pages are large, increasing maintenance risk.

## Evidence
### Files
- Auth and guardrails: `src/lib/auth.ts`, `src/lib/api.ts`, `src/middleware.ts`, `src/app/api/auth/[...nextauth]/route.ts`
- API domains: `src/app/api/**/route.ts`
- Services: `src/services/agendamento.service.ts`, `src/services/treino.service.ts`
- Scheduler/jobs: `src/lib/scheduler.ts`, `src/lib/jobs/cobranca-whatsapp.ts`
- Import pipeline: `src/lib/payments/feb2026-import.ts`, `utility/import-payments-feb-2026-docx.ts`, `RUNBOOK.md`
- Persistence: `prisma/schema.prisma`, `prisma/migrations/**`
- Runtime/deploy: `next.config.ts`, `vercel.json`, `Dockerfile`, `docker-compose.yml`, `.github/workflows/ci.yml`

### Commits
- `a0e14a9` - standardized Next.js middleware entrypoint.
- `1a16a42` - hardened auth/data endpoints, rate-limit surface expansion.
- `8df24b4` - tightened cron auth + extracted anamnese sanitization.
- `8f771b7` - fixed-slot recurrence model introduction.
- `9702602` - notifications and cron framework introduction.
- `70fb9fe` - payment import audit architecture addition.
- `3274441` - payment import behavior fixes and local dev UX script.

## Uncertainty
- External scheduler wiring (for invoking cron endpoints in production) is not declared in this repository.
- There is no explicit in-repo observability stack (metrics/traces sink); only logs and health checks are verifiable.
