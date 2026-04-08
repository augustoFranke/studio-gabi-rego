# Project Research Summary

**Project:** Gabi Rego Studio
**Domain:** Brownfield modernization of a fitness studio operations monolith
**Researched:** 2026-04-07
**Confidence:** HIGH

## Executive Summary

Gabi Rego Studio is already a real studio-operations product, not a greenfield concept. The research is consistent that the right modernization direction is to keep the existing Next.js monolith, keep Prisma and PostgreSQL, and improve the product by making current workflows trustworthy: measurable runtime behavior, explicit service ownership, durable background processing, cleaner date and scheduling policy, and faster core admin/member screens.

Experts would not rebuild this as microservices or swap frameworks first. They would harden the monolith in place: add telemetry, structured logging, and environment guardrails; make cron and notification work durable and replayable; move business rules out of routes and pages into service modules; and only then spend effort on performance and selective operator/member experience improvements. The biggest risks are invisible failures, non-transactional scheduling/payment mutations, distributed timezone logic, and scope drift into rewrite work or v2 features.

The roadmap should therefore optimize for trust before expansion. v1 scope should cover table-stakes hardening only: workflow correctness and idempotency, reliable booking and billing behavior, notification reliability with replay visibility, explicit lifecycle state, basic staff permissions and audit safety, and operational observability. Waitlists, retention insights, richer communication tooling, and training continuity upgrades are valid later, but only after the core loops are dependable.

## Key Findings

### Recommended Stack

Keep the current platform shape. Next.js 16, React 19, TypeScript, Prisma 6, PostgreSQL, SWR, Zod, React Hook Form, and the App Router are still the right foundation for this product. The next stack decisions should reduce operational risk, not add parallel frameworks or caches.

The important additions are cross-cutting: production telemetry, structured logs, explicit runtime/env guardrails, and durable background execution. The stack research prefers `@sentry/nextjs` plus `pino` immediately, then durable job execution with PostgreSQL-backed workflow state and Inngest as the preferred orchestration layer if a managed async runner is added. Auth replacement, Prisma 7 migration, and any service extraction should wait.

**Core technologies:**
- Next.js 16.1.1: full-stack monolith runtime; keep the App Router and standardize Node runtime usage for auth, PDF, Prisma, and cron-sensitive routes.
- React 19.2.3 + TypeScript 5.x: UI and domain language; current issues are boundary discipline and reliability, not framework capability.
- Prisma 6.19.1 + PostgreSQL: system of record; keep and harden with pooled runtime connections, safe migrations, backup posture, and better query visibility.
- SWR 2.4.x: client cache for interactive surfaces; keep as the only client data cache and avoid adding TanStack Query.
- Auth.js `5.0.0-beta.30`: current auth layer; keep for now but pin exactly and test deliberately.
- `@sentry/nextjs` + `pino`: first modernization additions; required for error visibility, release correlation, and structured incident triage.
- Inngest plus Postgres-backed job state: preferred durable job model; use only after observability and service ownership are in place.

### Expected Features

The feature research is clear that this milestone is about making the existing product production-grade, not making it broader. The app already covers the right domains; the missing value is reliability, auditability, recoverability, and operator clarity.

**Must have (table stakes / v1 scope):**
- Core workflow correctness and idempotency for scheduling, billing, reminders, and recurring updates.
- Reliable self-service booking, rescheduling, cancellation, and accurate schedule visibility.
- Predictable and auditable billing operations, including reminder safety and failure visibility.
- Notification delivery that is retryable, inspectable, deduplicated, and operator-replayable.
- Explicit member lifecycle state for onboarding, verification, profile completion, health form completion, and payment readiness.
- Basic staff permissions and audit safety around finance, member management, scheduling, and notifications.
- Operational visibility and recovery tooling for health, jobs, failures, and replay.
- Performance and consistency improvements on dashboards, schedule views, member lists, and finance screens.

**Should have (post-v1 differentiators):**
- Waitlist and fill-from-cancellation automation once schedule semantics are stable.
- No-show and attendance policy automation built on existing attendance data.
- Retention and at-risk member insights using onboarding, attendance, and payment signals already owned by the app.
- Operator workflow acceleration such as bulk actions, triage filters, templates, and faster finance workflows.

**Defer (v2+ or explicitly out of scope):**
- Multi-location or franchise support.
- Full CRM or marketing automation.
- Native mobile apps, POS/inventory, payroll/HR, wearables, community/gamification, and AI copilot features.
- Architecture rewrites, microservice extraction, or framework replacement.

### Architecture Approach

The correct target is a disciplined modular monolith. Keep one Next.js app and one PostgreSQL database, but make `src/app/**` a thin boundary layer, make `src/services/**` the owner of business rules and transactions, and keep `src/lib/**` limited to infrastructure adapters and pure utilities. Background work should become durable and auditable instead of living inside long-running cron HTTP requests, and observability should span request, job, and provider boundaries.

**Major components:**
1. `src/app/**`: pages, API routes, and server actions that handle auth, validation, serialization, and view state only.
2. `src/services/**`: per-domain commands, queries, policies, transactions, idempotency, and background-work orchestration.
3. `src/lib/**`: Prisma singleton, auth helpers, date policy, logging/tracing, and external provider adapters.
4. PostgreSQL durable state: core data plus job runs, outbox/delivery state, and idempotency records.
5. Observability layer: request IDs, job IDs, structured logs, traces, counters, and runbooks.

### Critical Pitfalls

1. **Refactoring before an operational baseline exists** — instrument cron, auth, health checks, notification attempts, and hot routes before changing critical logic.
2. **Treating cron HTTP routes as a reliable job system** — split triggers from execution, persist job state, and make retries/replay item-based rather than rerunning a whole endpoint.
3. **Leaving multi-step mutations non-transactional** — wrap recurring schedule, billing-state, and notification workflows in clear service-owned transactions.
4. **Keeping domain rules split across routes, pages, and raw Prisma calls** — make routes thin and move policy into service modules with stable contracts and tests.
5. **Preserving distributed timezone/date policy** — centralize local-date logic and recurrence calculations behind shared helpers with regression tests.

## Implications for Roadmap

Based on the combined research, the roadmap should use five phases.

### Phase 1: Operational Baseline
**Rationale:** Reliability work without visibility is guesswork; every later phase depends on knowing what failed and whether it improved.
**Delivers:** Sentry, structured JSON logging, request/job correlation IDs, startup env validation, health/cron/auth alert hooks, and initial runbooks.
**Addresses:** Operational visibility, trusted notification/billing operations, safe rollout of all later hardening.
**Avoids:** Refactoring blind, silent dependency failures, and treating CI green as production safety.

### Phase 2: Correctness and Idempotency
**Rationale:** Scheduling, reminders, billing state, and lifecycle state are the highest-risk behaviors already in production and are the biggest trust killers.
**Delivers:** Canonical timezone/date policy, transactional schedule and billing mutations, idempotent cron-triggered workflows, side-effect-free read paths, explicit lifecycle state, and replayable notification state transitions.
**Addresses:** Core workflow correctness, reliable self-service booking, auditable billing, notification reliability, and lifecycle clarity.
**Avoids:** Cron-as-worker fragility, partial writes, distributed date logic, and sync-on-read regressions.

### Phase 3: Boundary Extraction
**Rationale:** Once behavior is measurable and core rules are stabilized, extracting them behind service ownership reduces future change cost without risking a rewrite.
**Delivers:** Thin routes and server actions, per-domain service modules, read/query services for dashboards and member views, and migration of orchestration out of `src/lib/**`.
**Uses:** Existing Next.js monolith, Prisma, SWR, and Zod without introducing a second API layer.
**Implements:** The modular-monolith target where `src/services/**` owns policy and transactions.

### Phase 4: Performance and Frontend Maintainability
**Rationale:** Performance fixes should follow boundary cleanup so measured hotspots can be redesigned instead of patched locally.
**Delivers:** Faster dashboard, finance, schedule, and member-list paths; decomposed large client surfaces; reduced overfetching and sequential I/O on hot paths.
**Addresses:** Core screen speed and consistency, operator workflow efficiency, and frontend maintenance burden.
**Avoids:** Cosmetic refactors, micro-optimizations without architectural payoff, and backend-only hardening that leaves giant client modules untouched.

### Phase 5: Delivery Discipline and Documentation
**Rationale:** Hardening work does not stick unless tests, docs, CI, smoke checks, and operator runbooks match live behavior.
**Delivers:** Thin high-value E2E coverage, DB-backed integration tests for transactional flows, refreshed code-verified docs, release/smoke procedures, and aligned workflow guidance.
**Addresses:** Long-term safety for scheduling, notifications, auth, and deploy-time runtime behavior.
**Avoids:** Mock-heavy false confidence, stale review artifacts, and mixed behavior/process changes in one stream.

### Phase Ordering Rationale

- Phase 1 must come first because observability and env guardrails are prerequisites for safe brownfield changes.
- Phase 2 comes before feature or UI expansion because the table-stakes gap is trust, not missing modules.
- Phase 3 follows correctness work because service extraction is safer after transactional and date-policy contracts are clarified.
- Phase 4 is intentionally late so optimization targets are chosen from measured hot paths and cleaner boundaries.
- Phase 5 closes the loop by making the new operational contracts durable in tests, docs, and release practices.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Scheduling/date-policy hardening and durable job design need repo-specific validation against current recurrence behavior, provider failure modes, and data model constraints.
- **Phase 4:** Hot-path performance work should be driven by measured latency and bundle evidence, not assumptions; likely needs route- and page-specific investigation.

Phases with standard patterns (likely skip dedicated research-phase):
- **Phase 1:** Sentry, `pino`, env validation, and alert/runbook setup are well-documented and already aligned with the current stack.
- **Phase 3:** Thin-route modular-monolith extraction is strongly grounded in the current repo and does not require exploratory platform research.
- **Phase 5:** Playwright smoke coverage, integration-test expansion, and doc/runbook alignment follow established patterns and existing repo tooling.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Based on current repo constraints plus official Next.js, Vercel, Prisma, Sentry, and Inngest guidance; only durable-job implementation details remain open. |
| Features | MEDIUM-HIGH | Strong agreement between repo evidence and current fitness-software market baselines; differentiator priority still needs operator judgment. |
| Architecture | HIGH | Directly grounded in repo hotspots and consistent with the stated monolith constraint. |
| Pitfalls | HIGH | Specific to the current codebase and supported by both repo evidence and official platform guidance. |

**Overall confidence:** HIGH

### Gaps to Address

- Durable jobs implementation detail: decide during planning whether Inngest is adopted immediately or whether Postgres-backed workers land first behind the same service/outbox design.
- Permissions scope: validate the minimum admin-role split needed for this studio so v1 adds safety without accidental enterprise RBAC sprawl.
- Performance baseline: capture route, query, and client-bundle measurements before planning Phase 4 work items.
- Notification operations UX: confirm how operators should inspect, replay, and pause failed deliveries before locking UI scope.

## Sources

### Primary (HIGH confidence)
- `.planning/PROJECT.md` — project constraints, non-goals, and modernization intent
- `.planning/research/STACK.md` — stack and adoption-order recommendations
- `.planning/research/FEATURES.md` — table stakes, differentiators, and anti-features
- `.planning/research/ARCHITECTURE.md` — modular-monolith target and component boundaries
- `.planning/research/PITFALLS.md` — phase-specific failure modes and mitigations
- https://nextjs.org/docs/15/app/guides/instrumentation — framework instrumentation hook
- https://vercel.com/docs/cron-jobs and https://vercel.com/docs/observability — cron and runtime visibility guidance
- https://www.prisma.io/docs/concepts/components/prisma-client/working-with-prismaclient/connection-pool and https://www.prisma.io/docs/v6/orm/prisma-client/queries/transactions — connection and transaction guidance
- https://docs.sentry.io/platforms/javascript/guides/nextjs/ — Next.js telemetry guidance

### Secondary (MEDIUM confidence)
- https://www.inngest.com/docs and https://www.inngest.com/docs/guides/error-handling — managed job orchestration and retry/idempotency guidance
- https://www.capterra.com/fitness-software/ — current baseline feature expectations in the fitness-software market
- https://zenplanner.com/product/fitness-software-automations/ — vendor baseline for automation expectations
- https://support.vagaro.com/hc/en-us/articles/18977275541531-Configure-Access-Levels-and-Employee-Permissions — operator permission expectations
- https://help.wellnessliving.com/en/articles/9834437-book-an-appointment-as-a-client and https://help.wellnessliving.com/en/articles/9976935-forms-settings — booking, waitlist, and lifecycle expectations

### Tertiary (LOW confidence)
- None. The remaining uncertainty is implementation choice, not lack of evidence.

---
*Research completed: 2026-04-07*
*Ready for roadmap: yes*
