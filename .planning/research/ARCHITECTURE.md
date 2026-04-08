# Architecture Patterns

**Domain:** Existing fitness studio operations platform  
**Project:** Gabi Rego Studio  
**Researched:** 2026-04-07  
**Overall confidence:** HIGH for repo-grounded recommendations, MEDIUM for platform-specific observability options

## Target Topology

Evolve the current Next.js monolith into a **disciplined modular monolith**, not a distributed system.

That means:

- Keep one deployable Next.js app, one PostgreSQL database, and the current App Router shells.
- Make `src/app/**` a thin entrypoint layer.
- Make `src/services/**` the clear owner of business rules, transactions, idempotency, and background-work orchestration.
- Restrict `src/lib/**` to infrastructure adapters and pure shared utilities.
- Add a small observability layer and a durable jobs/outbox model inside PostgreSQL instead of introducing microservices or a second operational platform immediately.

This is the best fit for the repo as it exists today:

- the app already has role shells, API wrappers, Prisma, cron entrypoints, and nine service modules
- the main problem is boundary inconsistency, not top-level topology
- background work volume is still small enough that durable DB-backed processing is a better first move than queue-heavy infrastructure

## Recommended Architecture

```text
Browser / Cron / Ops trigger
  -> src/app pages, API routes, server actions
  -> auth + validation + request mapping only
  -> src/services/<domain>/*
  -> Prisma transactions + external adapters
  -> PostgreSQL / Resend / WhatsApp provider

Observability crosses all layers:
  request id, job run id, structured logs, traces, counters
```

## Component Boundaries

| Component | Responsibility | Communicates With | Must Not Do |
|-----------|----------------|-------------------|-------------|
| `src/app/(admin)/**`, `src/app/(aluno)/**`, `src/components/**`, `src/hooks/**` | Rendering, user interaction, view-state, calling server boundaries | API routes, server actions, server-side query services | Own business rules, build Prisma queries in client flows |
| `src/app/api/**/route.ts` | HTTP boundary: auth, Zod validation, status-code mapping, serialization | `src/services/**`, auth helpers | Hold business rules, duplicate transactions, talk to external providers directly |
| `src/app/actions/**` | Server Action boundary for React-triggered mutations | `src/services/**`, cache revalidation | Perform Prisma writes directly except during migration |
| `src/services/**` | Application layer: commands, queries, policies, transactions, idempotency | Prisma, `src/lib/**` adapters, shared domain types | Render UI, depend on route objects, mix unrelated domains in one file |
| `src/lib/**` | Infrastructure and pure helpers: Prisma singleton, auth adapter, date helpers, email/WhatsApp clients, logging/tracing | Framework APIs, env vars, vendor SDKs | Contain app orchestration like daily jobs or reminder policy |
| `prisma/schema.prisma` | Persistence model and durable operational state | Services via Prisma | Become a dumping ground for ad hoc workflow state without ownership |

## Current Repo Mapping

The target should be grounded in the current hot spots:

- `src/app/(admin)/dashboard/page.tsx` and `src/app/(aluno)/inicio/page.tsx` still read Prisma directly for non-trivial dashboards.
- `src/app/actions/membros.ts` still performs direct Prisma writes.
- `src/lib/scheduler.ts` owns app orchestration even though it is not infrastructure.
- `src/lib/jobs/cobranca-whatsapp.ts` and `src/lib/notification-delivery.ts` mix delivery workflow with persistence and retry state.
- `src/services/agendamento.service.ts` owns important scheduling rules, but future-scope mutations are still multi-step and not fully transactional.
- `src/app/api/notificacoes/route.ts`, `src/app/api/membros/**`, and some auth/profile routes still carry too much application logic.

Those are the boundaries to clean up first. The rest of the monolith shape is broadly correct.

## What Should Stay As-Is

### Keep the monolith

Do not split this system into microservices. The domains are tightly coupled, the team size does not justify extra operational complexity, and the existing app already has useful test coverage around one deployable unit.

### Keep App Router role shells

`src/app/(admin)`, `src/app/(aluno)`, and `src/app/(auth)` are good shell boundaries. They match the product and should remain the top-level navigation structure.

### Keep Prisma + PostgreSQL

The current schema is coherent, and PostgreSQL is already the best place to add durable job state, idempotency keys, and execution ledgers.

### Keep `withApiAuth()`, Zod validation, and defense-in-depth auth

The auth pattern is correct in principle. It needs consistency, not replacement.

### Keep hybrid SSR + interactive client pages

Do not force all data through client-side APIs. Server-rendered pages should call server-side query services directly when that is the cleanest path. Client pages should continue using API routes or server actions.

### Keep Vercel cron as a scheduler trigger

Vercel cron is a valid trigger mechanism. The change is that cron should become a **producer of durable work**, not the place where the full workload executes inline.

## Recommended Refactor Shape

Stay incremental. Do not introduce a grand new framework. Evolve the existing `src/services/` directory into per-domain folders as each area is touched.

Recommended shape:

```text
src/services/
  agendamentos/
    commands.ts
    queries.ts
    recurrence.ts
  membros/
    commands.ts
    queries.ts
  pagamentos/
    commands.ts
    queries.ts
    reminders.ts
  onboarding/
    signup.ts
    verification.ts
    profile.ts
    recovery.ts
  notificacoes/
    delivery.ts
    outbox.ts
  ops/
    daily-jobs.ts
    cleanup.ts
  shared/
    errors.ts
    result.ts

src/lib/
  auth.ts
  prisma.ts
  dates.ts
  observability/
    logger.ts
    context.ts
    metrics.ts
  whatsapp/
  security/
```

This is not a rewrite. It is a re-homing of current responsibilities:

- move orchestration out of `src/lib/scheduler.ts` into `src/services/ops/daily-jobs.ts`
- move reminder workflow ownership out of `src/lib/jobs/cobranca-whatsapp.ts` into `src/services/pagamentos/reminders.ts`
- keep provider wrappers in `src/lib/resend.ts` and `src/lib/whatsapp/evolution.ts`
- split large flat service files when touched, not all at once

## Data Flow Implications

### Interactive mutations

Target flow:

```text
Client page/hook
  -> API route or server action
  -> command service
  -> Prisma transaction + side effects
  -> typed result
  -> HTTP/action response + cache revalidation
```

Implication: route handlers stop owning rules like member validation, notification creation, or payment state transitions. They only translate web concerns.

### Server-rendered reads

Target flow:

```text
Server page
  -> query service
  -> Prisma read model
  -> rendered page
```

Implication: pages such as `dashboard`, `inicio`, `alunos`, and training detail screens should stop composing large Prisma queries inline once the query is reused, policy-heavy, or performance-sensitive.

### Background work

Target flow:

```text
Vercel cron / manual ops endpoint
  -> cron auth
  -> create job run + enqueue work items in PostgreSQL
  -> small-batch worker endpoint or worker process drains queue
  -> delivery adapter sends message
  -> attempt + final status persisted
```

Implication:

- cron becomes restartable and auditable
- retries no longer depend on rerunning a whole endpoint manually
- reminder delivery, recurring sync, and cleanup become individually measurable
- external provider failures stop being tightly coupled to one HTTP request window

### Observability

Target flow:

```text
entrypoint -> request context -> service -> adapter
           -> structured log + trace span + counters
```

Implication: job runs, route requests, and provider failures all share correlation ids. That makes cron failures and partial sends diagnosable without manual log archaeology.

## Build Order

### Phase 1: Boundary hardening and observability foundation

Build first because later work depends on clearer ownership.

- Add `src/lib/observability/logger.ts` and request/job context helpers.
- Add a lightweight shared service convention: typed errors, result mapping, and log fields.
- Refactor the easiest boundary leaks first:
  - `src/app/actions/membros.ts`
  - `src/app/api/notificacoes/route.ts`
  - member and payment routes that already have service nuclei
- Extract read services for:
  - `src/app/(admin)/dashboard/page.tsx`
  - `src/app/(aluno)/inicio/page.tsx`
  - optionally `src/app/(admin)/alunos/page.tsx`

Exit condition:

- new or touched routes do not import Prisma directly
- server actions delegate to services
- logs are structured enough to tag route, user role, and request/job id

### Phase 2: Scheduling and date-policy hardening

Build second because scheduling is the most fragile domain-level behavior already in production.

- Centralize all app timezone and local-date policy behind `src/lib/dates.ts` plus service-level helpers.
- Remove read-side writes where possible:
  - `GET /api/agendamentos` should not be the main trigger for recurrence sync long-term.
- Wrap future-scope schedule mutations in explicit transactions.
- Add focused service tests for:
  - recurrence sync
  - future update/delete behavior
  - capacity and dedupe guarantees

Exit condition:

- recurrence materialization has one owner
- transaction boundaries are explicit
- scheduling behavior no longer depends on whichever read endpoint runs first

### Phase 3: Durable background processing

Build third because it depends on cleaner service boundaries and better date policy.

- Introduce durable DB-backed workflow state, likely with tables such as:
  - `JobRun`
  - `JobItem` or `OutboxMessage`
  - `NotificationAttempt`
- Make `/api/cron/tarefas-diarias` create a run record and enqueue work items.
- Drain items in bounded batches through a dedicated worker entrypoint or a small self-hosted worker process if that deployment path is used.
- Route both manual ops execution and cron execution through the same service functions.
- Preserve idempotency with stable keys, building on the existing `Notificacao.chaveDedupe`.

Exit condition:

- background work is replayable
- retries are per item, not per whole cron run
- provider failures are visible in durable state

### Phase 4: Production-grade observability and runbooks

Build fourth because it becomes much more useful once job and service boundaries are stable.

- Add `src/instrumentation.ts` and wire OpenTelemetry-compatible tracing for server startup and request error hooks.
- Emit counters and timings for:
  - cron runs
  - queue depth / pending items
  - sent / skipped / failed notifications
  - auth-rate-limit failures
  - health endpoint failures
- Connect those signals to the chosen sink:
  - Vercel Observability if staying Vercel-first
  - another OTel-compatible backend if self-hosting becomes primary
- Write operator runbooks for auth outage, provider outage, and failed cron replay.

Exit condition:

- silent failures become unlikely
- the team can answer "what failed, where, and how often?" without reading raw console output

## What Not To Do

### Do not introduce microservices

That would increase operational risk before the monolith boundaries are clean.

### Do not introduce a generic repository abstraction everywhere

Prisma is already a good data access tool. The missing layer is application ownership, not another abstraction layer over every query.

### Do not force SSR pages through internal HTTP

Server pages should call query services directly. Internal HTTP adds latency and duplicates auth concerns.

### Do not add Redis/BullMQ just for a small number of daily jobs

That would add a second persistence and worker platform before PostgreSQL-backed durability has been exhausted.

### Do not keep app orchestration in `src/lib/**`

`src/lib` should stay for infrastructure and pure helpers. Daily jobs, reminder policies, and recurrence ownership belong in services.

## Architecture Recommendation

The next-phase target is:

1. **Thin controllers** in `src/app/**`
2. **Per-domain application services** in `src/services/**`
3. **Infra-only `src/lib/**`**
4. **Postgres-backed durable job state**
5. **Observability as a shared cross-cutting layer**

That gets the system cleaner, easier to maintain, and more production-grade without changing its deployment shape or forcing a rewrite.

## Sources

### Repo evidence

- `.planning/PROJECT.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/STRUCTURE.md`
- `.planning/codebase/CONCERNS.md`
- `ARCHITECTURE_REVIEW.md`
- `src/app/(admin)/dashboard/page.tsx`
- `src/app/(aluno)/inicio/page.tsx`
- `src/app/actions/membros.ts`
- `src/app/api/cron/tarefas-diarias/route.ts`
- `src/app/api/health/route.ts`
- `src/lib/scheduler.ts`
- `src/lib/jobs/cobranca-whatsapp.ts`
- `src/lib/notification-delivery.ts`
- `src/lib/api.ts`
- `src/proxy.ts`
- `src/services/agendamento.service.ts`
- `src/services/membro.service.ts`
- `src/services/pagamento.service.ts`
- `prisma/schema.prisma`
- `vercel.json`

### External references

- Next.js instrumentation guide: https://nextjs.org/docs/15/app/guides/instrumentation  
  Confidence: HIGH for `instrumentation.ts` as the framework hook for monitoring/tracing setup.
- Vercel Cron Jobs docs: https://vercel.com/docs/cron-jobs  
  Confidence: HIGH for cron as HTTP-triggered scheduling rather than durable background execution.
- Vercel Observability docs: https://vercel.com/docs/observability  
  Confidence: MEDIUM-HIGH for a Vercel-native sink if the current deployment remains Vercel-first.
- Vercel Queues concepts: https://vercel.com/docs/queues/concepts  
  Confidence: MEDIUM. Useful as a future option, but not the default recommendation here because it adds new managed infrastructure and is unnecessary for the current milestone.

## Confidence Notes

- **HIGH:** Keep monolith, thin request boundaries, move orchestration into services, use PostgreSQL for durable workflow state.
- **MEDIUM-HIGH:** Add Next.js instrumentation and structured observability early.
- **MEDIUM:** Adopt a managed queue product later only if DB-backed batch processing proves insufficient or Vercel-first async throughput becomes a real bottleneck.
