# Technology Stack

**Project:** Gabi Rego Studio
**Researched:** 2026-04-07
**Scope:** Stack-level modernization guidance for the existing fitness studio operations monolith

## Decision Summary

- Keep the Next.js monolith on Vercel. The next milestone should harden the current deployment model, not replace it.
- Keep Prisma + PostgreSQL, but treat pooled connections, migrations, backups, and query visibility as first-class platform concerns.
- Keep SWR, Zod, React Hook Form, Vitest, and the App Router. Do not add a second API layer or a second client data cache.
- Add production telemetry first: `@sentry/nextjs` plus structured JSON logging with `pino`.
- Add durable background execution next: use Inngest for retries, idempotent workflows, and job observability. Vercel Cron should become a trigger, not the worker.
- Defer auth replacement, Prisma 7 generator migration, and microservice extraction until after observability and job hardening are in place.

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 16.1.1 | Full-stack monolith runtime | Keep. The repo is already App Router-first, Vercel-native, and has server routes, server pages, PDFs, and auth wired into this model. The modernization work should standardize `runtime = "nodejs"` and route-level runtime config for Node-only surfaces instead of changing frameworks. |
| React | 19.2.3 | UI runtime | Keep. No stack-level problem here. The maintainability issues are page/module boundaries, not React itself. |
| TypeScript | 5.x | Application and domain language | Keep. Use stricter service boundaries and typed env/config instead of adding more abstraction layers. |
| Auth.js / NextAuth | `5.0.0-beta.30` pinned exactly | Session/auth layer | Keep for now, but stop floating the beta with `^`. This app already depends on current Auth.js patterns; auth churn is not the leverage point for the next milestone. Pin, test, and upgrade deliberately later. |
| SWR | 2.4.x | Client cache for interactive admin/member surfaces | Keep. It matches the current route-handler architecture. Do not introduce TanStack Query while service boundaries and route contracts are still moving. |

### Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PostgreSQL | 16-compatible managed service | Primary OLTP database | Keep. The schema and CI already assume PostgreSQL. Require pooled app connections, PITR/automated backups, slow-query visibility, and a staging or preview-safe database strategy before adding any new persistence technology. |
| Prisma ORM | 6.19.1 | ORM, migrations, type-safe data access | Keep. The brownfield win is better transaction discipline and query shaping, not replacing the ORM. Use `directUrl` only for migrations and a pooled runtime URL for the app. |
| PgBouncer-compatible or provider-native pooler | Provider-managed | Connection control for Vercel/Node runtime | Add or verify explicitly. The app already separates `DATABASE_URL` and `DIRECT_URL`; the next phase should guarantee that runtime traffic goes through a supported pooler and migrations bypass it. |

### Infrastructure

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel | Current project platform | Web hosting, serverless functions, cron triggers, previews | Keep. The repo is already configured for Vercel and `gru1`. The key change is operational: long-running cron work should leave the request path. |
| GitHub Actions | Existing workflow | Required CI gates and migration validation | Keep. CI already validates typecheck, lint, tests, build, and migrations. Make that the deployment gate instead of treating Vercel build as the main quality check. |
| `@sentry/nextjs` | 10.42.0 or current compatible release | Errors, traces, cron monitoring, release/source-map visibility | Add first. This codebase currently relies on `console.*` and ad hoc logs. Sentry gives the fastest path to production visibility across App Router, route handlers, background triggers, and browser failures. |
| `pino` | latest stable | Structured JSON logs | Add first. The app needs correlation-friendly logs for cron runs, notification delivery, auth failures, and database-related incidents. Emit JSON to stdout and let platform tooling ingest it. |
| Inngest | 4.x | Durable background jobs, retries, step-based workflows, job observability | Add second. It fits the existing monolith, works well with Next.js, and directly addresses the current cron/notification fragility without introducing self-hosted queue infrastructure. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Playwright | 1.57.x | Smoke E2E for auth, onboarding, schedule, and payment-critical paths | Keep and activate. The package is already installed; use it for a small, reliable production-smoke suite instead of adopting a new E2E runner. |
| Zod | 4.3.x | Env and request validation | Keep. Reuse it to centralize environment validation at boot rather than adding another config library. |
| Upstash rate limiting | existing | Auth endpoint protection | Keep narrowly scoped to auth and abuse control. Do not expand Redis into a queue or cache layer just because it is already present. |

## Platform Practices

### Keep

- Keep the monolith. The current team and product shape do not justify service extraction.
- Keep Vercel as the main runtime and keep `gru1` aligned with the database region.
- Keep Prisma/PostgreSQL as the only system of record.
- Keep route handlers and server actions. Do not add tRPC or GraphQL in this milestone.
- Keep SWR as the only client data cache.

### Add Now

- Add Sentry across browser, server, and cron-trigger paths using the existing `src/instrumentation.ts` entrypoint.
- Add `pino` and standardize a logger wrapper so every route, service, and job logs with request ID, job ID, member ID, and external provider context.
- Move long-running cron work to Inngest functions. Vercel Cron should enqueue or emit events only.
- Add startup env validation with a single server-only module built on existing Zod. Missing base URL, cron secret, auth secret, Redis, Resend, or WhatsApp config should fail fast.
- Mark all Prisma, PDF, auth, and cron-related routes with explicit `runtime = "nodejs"` and set route-level `preferredRegion` where locality matters.
- Make preview/staging environments use non-production databases. Preview deploys against production data are too risky for this app.
- Keep `prisma migrate deploy` as a controlled production action. CI should continue proving migrations apply cleanly to an empty database.
- Use Sentry alerts plus health checks for missed cron triggers, repeated delivery failures, auth-rate-limit failures, and elevated 5xx rates.

### Defer

- Defer Prisma 7's Rust-free generator migration. It is a real migration with generator/output/runtime implications, not a free dependency bump.
- Defer replacing Auth.js with Better Auth or a custom auth stack. The repo already has working auth and bigger risks elsewhere.
- Defer Prisma Accelerate/Optimize or other paid query products until baseline telemetry is live and actual hotspots are visible.
- Defer read replicas, cache layers, or search infrastructure until traced production traffic proves they are necessary.
- Defer any self-hosted queue stack such as BullMQ, RabbitMQ, or Kafka. They add operational burden without matching current scale.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Background execution | Inngest | Keep doing work directly inside Vercel Cron handlers | Current cron endpoints already serialize too much work into one request. Vercel cron is fine as a trigger, not as the durable execution layer. |
| Background execution | Inngest | Trigger.dev | Reasonable alternative, but Inngest is the simpler fit for event- and cron-driven workflows inside an existing Next.js monolith. Choose Trigger.dev only if future work requires its specific task/runtime model. |
| Observability | Sentry + Pino | Vercel-only logs/observability | Vercel platform telemetry is useful, but it is not enough for app-level exception grouping, source maps, release correlation, and cross-runtime incident triage. |
| Client data layer | Keep SWR | Add TanStack Query | This repo does not have a cache-architecture problem; it has service-boundary and route-contract problems. Another client data layer would increase migration surface without fixing that. |
| API shape | Route handlers + server actions | Add tRPC/GraphQL | Premature. The current bottleneck is inconsistent business-logic ownership, not transport ergonomics. |
| Prisma runtime | Stay on Prisma 6 for now | Jump to Prisma 7 rust-free generator immediately | Worth doing later, but not in the same phase as observability, jobs, and deploy hardening. Too many moving parts at once. |

## Installation

```bash
# Observability and logs
npm install @sentry/nextjs pino

# Durable background jobs
npm install inngest
```

## Recommended Adoption Order

1. Add telemetry and structured logging.
2. Add env validation and runtime/deploy guardrails.
3. Move cron and notification execution to durable jobs.
4. Use telemetry to target database/query and page-bundle fixes.
5. Only then schedule auth and Prisma major-version migrations.

## Sources

- Next.js instrumentation guide: https://nextjs.org/docs/15/app/guides/instrumentation
- Vercel Cron usage and limits: https://vercel.com/docs/cron-jobs/usage-and-pricing
- Vercel Function limits and duration: https://vercel.com/docs/functions/limitations
- Vercel Function duration config: https://vercel.com/docs/functions/configuring-functions/duration
- Vercel Drains: https://vercel.com/docs/drains/using-drains
- Prisma connection pooling: https://www.prisma.io/docs/concepts/components/prisma-client/working-with-prismaclient/connection-pool
- Prisma with PgBouncer: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer
- Prisma engines and Prisma 7 generator changes: https://www.prisma.io/docs/v6/orm/more/internals/engines
- Sentry Next.js guide: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- Auth.js current homepage and public example: https://authjs.dev/ and https://nextjs-docker-example.authjs.dev/
- Inngest docs overview: https://www.inngest.com/docs
- Inngest retries and idempotency guidance: https://www.inngest.com/docs/guides/error-handling
