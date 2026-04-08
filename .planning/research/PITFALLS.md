# Domain Pitfalls

**Domain:** Brownfield hardening of a live fitness studio operations monolith
**Researched:** 2026-04-07
**Overall confidence:** HIGH

## Recommended Hardening Phases

Use these phase names consistently in the roadmap so pitfall ownership is obvious:

| Phase | Goal |
|------|------|
| Phase 1: Operational Baseline | Make runtime behavior measurable and contracts trustworthy before deeper refactors |
| Phase 2: Correctness and Idempotency | Fix business-critical data, cron, scheduling, and external delivery semantics |
| Phase 3: Boundary Extraction | Move domain rules out of route/page code and behind service-level ownership |
| Phase 4: Performance and Frontend Maintainability | Reduce hot-path waste, bundle sprawl, and oversized UI modules |
| Phase 5: Delivery Discipline and Documentation | Keep docs, tests, CI, and runbooks aligned with reality so hardening sticks |

## Critical Pitfalls

### Pitfall 1: Refactoring before establishing an operational baseline
**What goes wrong:** The team changes cron, auth, dashboard queries, or scheduling code without first making failures visible. In this repo that would mean modifying `src/lib/scheduler.ts`, `src/services/agendamento.service.ts`, or auth flows while still depending mostly on logs and ad hoc DB inspection to know what broke.
**Why it happens:** Brownfield teams see obvious code smells and jump straight into cleanup. On a live monolith, that is backwards. Reliability work without observability turns every refactor into guesswork.
**Consequences:** Slow incident detection, false confidence after deploys, and inability to prove that the hardening work improved anything.
**Warning signs:**
- Cron failures are discovered from member complaints instead of metrics or alerts.
- Route performance problems are inferred from feel, not measured latency/error data.
- A PR changes critical runtime behavior but adds no logs, dashboards, or alert hooks.
- There is no agreed owner for `/api/cron/*`, health checks, or auth outage response.
**Prevention:**
- Add structured telemetry for cron runs, notification send attempts, health checks, auth rate-limit failures, and dashboard hot paths before changing logic.
- Define a small set of service-level indicators for the monolith: cron success rate, notification failure rate, auth failure rate, slowest routes, and next-class query latency.
- Create runbooks for cron auth failures, provider outages, and migration failures.
- Treat `vercel.json`, route handlers, and runtime behavior as canonical; update docs after verifying code, not before.
**Phase to address:** Phase 1: Operational Baseline
**Repo-specific notes:** The repo already has `src/lib/runtime-log.ts`, Vercel deployment, and CI. The missing piece is production-grade visibility, not a new platform.

### Pitfall 2: Treating the cron path like a reliable job system
**What goes wrong:** A single HTTP cron request keeps orchestrating overdue payment updates, birthday notifications, and recurring schedule sync, with external sends inside the request path. That works at small scale, then silently becomes fragile when provider latency, retries, or partial failures increase.
**Why it happens:** Serverless cron endpoints are easy to add, so teams mistake "scheduled HTTP invocation" for durable background processing.
**Consequences:** Duplicate or dropped reminders, long-running cron requests, hard-to-replay failures, and operational coupling between unrelated jobs.
**Warning signs:**
- One cron endpoint performs multiple unrelated duties.
- External sends happen sequentially inside a request loop.
- Failed notifications remain in a bad state until someone manually reruns an endpoint.
- Job summaries exist, but there is no replay queue or bounded worker model.
**Prevention:**
- Split compute from delivery: generate notification jobs first, then deliver them through a bounded retryable worker path.
- Keep each cron entrypoint narrowly scoped and idempotent.
- Persist delivery state transitions explicitly: pending, sending, sent, failed, retryable, dead-lettered.
- Add replay tooling for failed sends instead of relying on rerunning the whole cron route.
- Keep cron auth strict and documented; validate `CRON_SECRET` in every environment.
**Phase to address:** Phase 2: Correctness and Idempotency
**Repo-specific notes:** `src/app/api/cron/tarefas-diarias/route.ts`, `src/lib/scheduler.ts`, `src/lib/jobs/cobranca-whatsapp.ts`, and `src/lib/notification-delivery.ts` already show the seam where durable delivery should be introduced.

### Pitfall 3: Leaving business-critical multi-step mutations non-transactional
**What goes wrong:** Schedule recurrence edits, deletes, or sync operations span multiple writes across `HorarioFixo`, `Agendamento`, and notification-related tables without one clear transactional contract per use case.
**Why it happens:** Brownfield teams patch the visible bug first, but do not tighten the underlying write model.
**Consequences:** Partial updates, race-condition bugs, orphaned records, and difficult rollback behavior during concurrent edits.
**Warning signs:**
- A "future" edit or delete touches several tables in sequence outside one transaction.
- Service logic fetches, deletes, creates, and refreshes records across multiple awaits with no failure boundary.
- Bugs show up only under concurrent admin actions or partial provider/database failures.
- Existing tests mostly assert mocked call shape instead of transactional behavior.
**Prevention:**
- Define transactional units around recurring schedule mutations and notification state changes.
- Use service-level APIs that either fully succeed or explicitly surface partial failure recovery.
- Add integration tests for concurrent schedule edits, repeated cron invocations, and partial-failure rollback paths.
- Keep transactions short and avoid network work inside them.
**Phase to address:** Phase 2: Correctness and Idempotency
**Repo-specific notes:** The main risk lives in `src/services/agendamento.service.ts` and notification delivery flows, not in Prisma itself.

### Pitfall 4: Keeping domain rules split across routes, pages, and raw Prisma calls
**What goes wrong:** Route handlers and pages keep owning validation, authorization edge cases, query shaping, side-effect orchestration, and persistence details directly. Each feature then evolves differently and no one layer truly owns the business rule.
**Why it happens:** In a monolith, route-first development feels fast. Over time it creates many shallow owners instead of one reliable application layer.
**Consequences:** Expensive policy changes, duplicated bugs, brittle tests, and refactors that require touching too many files.
**Warning signs:**
- Route handlers directly call Prisma for domain writes that already have nearby service logic.
- Similar rules exist in `src/app/api/*`, server actions, and page loaders with slightly different behavior.
- New tests are mostly route tests because there is no stable service seam to test.
- Admin-only mutation routes accept loosely validated request shapes and persist them directly.
**Prevention:**
- Make route handlers thin: auth, input validation, HTTP mapping only.
- Move mutation and query policy into service modules with explicit input/output contracts.
- Stop adding new raw Prisma writes to `src/app/api` when the rule belongs to members, scheduling, onboarding, payments, or notifications.
- Add service-level tests before extracting large route logic so behavior stays pinned.
**Phase to address:** Phase 3: Boundary Extraction
**Repo-specific notes:** This is already visible in member, payment, notification, and onboarding routes called out in `.planning/codebase/CONCERNS.md`.

### Pitfall 5: Allowing read paths to keep mutating state
**What goes wrong:** A GET flow becomes responsible for repairing or generating missing data. That makes reads non-deterministic, complicates caching, and hides write load inside supposedly safe user interactions.
**Why it happens:** It is a pragmatic brownfield shortcut: "sync on read" avoids building a proper maintenance path.
**Consequences:** Unpredictable latency, race conditions, accidental duplicate work, and misleading performance investigation.
**Warning signs:**
- A list/read endpoint has to "ensure" or "sync" data before returning.
- Route latency depends on whether the system needs to repair missing state.
- Caching and invalidation conversations keep stalling because reads are not pure.
- Operators cannot tell whether state was generated by cron, admin action, or page visit.
**Prevention:**
- Move repair and generation logic to explicit jobs or write-time workflows.
- Keep GET handlers side-effect free unless the side effect is the explicit contract.
- Add reconciliation jobs for recurring schedules instead of hiding them behind user reads.
- Document the source of truth for generated schedule state.
**Phase to address:** Phase 2: Correctness and Idempotency
**Repo-specific notes:** The current `listAgendamentos()` implementation is clean, but this class of bug already appeared in prior repo reviews and should stay blocked from re-entering the codebase.

### Pitfall 6: Preserving distributed timezone policy
**What goes wrong:** "Today," "tomorrow," due dates, and recurring slots are calculated from multiple clocks, string formats, and local fixes. The system mostly works until midnight boundaries, date-only storage, or cross-environment behavior expose inconsistencies.
**Why it happens:** Teams patch each broken screen or cron instead of declaring one canonical date policy.
**Consequences:** Wrong next-class cards, incorrect billing reminder windows, flaky recurring schedule sync, and subtle user trust damage.
**Warning signs:**
- New code imports `Date` and hand-rolls local-date logic instead of going through shared helpers.
- Different modules default to different IANA timezones.
- "Normalize to noon" or string-key comparison shows up in several places.
- Bugs cluster around same-day filtering, due-date math, or day-of-week recurrence.
**Prevention:**
- Define one application timezone policy and one canonical local-date abstraction.
- Centralize date parsing, YMD conversion, and next-occurrence math behind a small module with strict tests.
- Reject new raw date logic in routes, pages, and services unless it uses the shared policy.
- Add regression tests around midnight, DST-adjacent dates, and mixed server/client rendering boundaries.
**Phase to address:** Phase 2: Correctness and Idempotency
**Repo-specific notes:** `src/lib/dates.ts` and `src/lib/schedule.ts` should become the only sanctioned path for schedule/date rules.

### Pitfall 7: Mistaking broad mocked tests for production confidence
**What goes wrong:** The suite passes because route modules, Prisma calls, and auth wrappers are mocked effectively, but the live risk sits in real database behavior, UI interaction wiring, redirects, cron replay, and provider integration.
**Why it happens:** Brownfield teams optimize for fast tests and stop short of the small number of higher-fidelity checks that catch operational regressions.
**Consequences:** Confident refactors still break production-only behavior, especially around redirects, schedules, cron auth, and client-heavy pages.
**Warning signs:**
- Most coverage sits in route tests with mocked Prisma and mocked auth.
- There are no E2E tests for member/admin critical journeys.
- CI proves migrations apply, but not that key flows work against a real database-backed app.
- Large client components change often with no UI tests.
**Prevention:**
- Keep the current Vitest suite, but add a thin E2E layer for auth, schedule, payment, and notification-critical flows.
- Add database-backed integration tests for transactional schedule and notification scenarios.
- Use coverage as a signal, but gate releases on scenario coverage for the highest-risk flows.
- Ensure health, cron auth, redirect policy, and dashboard next-class behavior are tested as real contracts, not mocked assumptions.
**Phase to address:** Phase 5: Delivery Discipline and Documentation
**Repo-specific notes:** The repo already includes Playwright as a dependency and CI infra that can grow into this without a tooling reset.

### Pitfall 8: Chasing performance with local micro-optimizations instead of hot-path redesign
**What goes wrong:** The team tweaks individual queries or components while the real waste remains at the boundary level: oversized client pages, overfetch-and-filter patterns, and sequential I/O in request handlers.
**Why it happens:** Local optimizations are easier to ship than decomposing a hot path by responsibility.
**Consequences:** Little user-visible improvement, continued slow dashboards, and harder future refactors because complexity stays concentrated.
**Warning signs:**
- A large page keeps growing while developers patch small render issues inside it.
- Queries fetch a broad set and filter the "real" answer in application code.
- Sequential provider/database work dominates route latency.
- Performance discussions focus on library choice instead of measured route/component bottlenecks.
**Prevention:**
- Start with measured slow routes and heavy client bundles, not generic optimization work.
- Push future-slot and aggregate predicates into queries where possible.
- Split giant client pages by responsibility: transport, dialogs, tables, stats, mutations.
- Treat bounded concurrency and batching as first-class design work for delivery jobs.
**Phase to address:** Phase 4: Performance and Frontend Maintainability
**Repo-specific notes:** The admin finance page and dashboard next-class queries are the clearest current examples.

### Pitfall 9: Letting external dependencies become silent single points of failure
**What goes wrong:** Auth, email, WhatsApp, or Redis-backed rate limiting fail in ways the application does not degrade gracefully or expose clearly to operators.
**Why it happens:** Vendor integrations are added as libraries, but not treated as reliability dependencies with explicit fallback policy.
**Consequences:** User-facing auth outages, silent message loss, and confusing support incidents where the app is "up" but key workflows are broken.
**Warning signs:**
- A provider outage flips a core route from available to fully blocked with no operator playbook.
- Delivery failures surface only in logs or database rows.
- Environment configuration silently falls back to production-ish defaults.
- No one can answer which dependencies are fail-open, fail-closed, or retryable.
**Prevention:**
- Classify each dependency by outage policy: fail-open, fail-closed, retry later, or disable feature.
- Add health indicators and alerting for Redis, email, and WhatsApp provider errors.
- Remove unsafe fallback URLs and ambiguous environment defaults.
- Create manual operator procedures for pausing sends, replaying failures, and handling auth rate-limit dependency issues.
**Phase to address:** Phase 1: Operational Baseline and Phase 2: Correctness and Idempotency
**Repo-specific notes:** `src/lib/rate-limit.ts`, onboarding/email flows, and WhatsApp delivery are the current pressure points.

### Pitfall 10: Allowing docs and review artifacts to drift from live behavior
**What goes wrong:** Teams keep planning against stale architecture notes, stale review findings, or route assumptions that were true last month but are false now. Brownfield hardening then solves the wrong problem.
**Why it happens:** Docs are treated as optional cleanup instead of part of the contract surface.
**Consequences:** Mis-prioritized roadmap phases, duplicated fixes, and recurring debates about how the system "really" works.
**Warning signs:**
- A review document claims behavior that current code no longer has.
- Route topology in docs does not match `vercel.json` and the actual `src/app/api` tree.
- PRs change runtime contracts without any docs or runbook update.
- New contributors use docs as truth and get blocked by reality.
**Prevention:**
- Make contract docs part of definition of done for cron, auth, deployment, and scheduling changes.
- Prefer code-verified docs that link to actual entrypoints and tests.
- Retire or rewrite stale review findings once code changes invalidate them.
- Keep one canonical workflow doc for branch, PR, validation, and release expectations.
**Phase to address:** Phase 5: Delivery Discipline and Documentation
**Repo-specific notes:** The 2026-04-01 `PROJECT_REVIEW.md` still contains findings that no longer match current code, which is itself a roadmap hazard.

### Pitfall 11: Turning reliability work into a disguised rewrite
**What goes wrong:** The team interprets "production-grade" as a reason to redesign the platform, split services, or replace the framework instead of fixing the concrete failure modes in the existing monolith.
**Why it happens:** Brownfield debt feels structurally painful, so a rewrite sounds cleaner than disciplined incremental change.
**Consequences:** Delivery slows, risk rises, and the same missing contracts and tests reappear in a new shape.
**Warning signs:**
- Proposed phases start with architecture migration instead of operational correctness.
- The roadmap introduces microservices before the current monolith has stable boundaries.
- Teams talk more about platform churn than about member-facing failure modes.
- Reliability goals are framed as "modernize the stack" instead of measurable behavior changes.
**Prevention:**
- Keep the monolith and harden it in place.
- Use incremental extraction only where a subsystem boundary is already obvious and heavily tested.
- Demand rollback plans and success metrics for every major structural change.
- Prefer strangler-style replacement of one seam at a time over broad rewrites.
**Phase to address:** All phases, enforced from roadmap creation onward
**Repo-specific notes:** `.planning/PROJECT.md` is correct to keep microservice decomposition and framework migration out of scope for this milestone.

## Moderate Pitfalls

### Pitfall 12: Mixing workflow/process changes with behavior changes
**What goes wrong:** A branch changes business logic, docs, workflow policy, and infra assumptions together. Review scope becomes too wide and regressions slip through.
**Warning signs:**
- PRs contain unrelated app logic, workflow, and docs changes in the same diff.
- Review comments keep switching between product behavior and repo process concerns.
- Rollback is hard because one merge bundled several intents together.
**Prevention:** Keep each PR scoped to one subsystem or one hardening objective, and only mix workflow/doc changes when they are required by the behavior change.
**Phase to address:** Phase 5: Delivery Discipline and Documentation

### Pitfall 13: Hardening only backend logic while leaving giant client surfaces untouched
**What goes wrong:** Backend rules improve, but the real maintenance burden remains in oversized client pages and forms that still own too much state and transport logic.
**Warning signs:**
- Backend services get cleaner while large client files keep growing.
- UI regressions cluster around dialogs, filters, and mutation flows in giant pages.
- Frontend performance problems are blamed on the API while the client bundle remains oversized.
**Prevention:** Treat large client components as maintainability hotspots with their own decomposition phase, not as "just UI."
**Phase to address:** Phase 4: Performance and Frontend Maintainability

## Minor Pitfalls

### Pitfall 14: Cleaning up names and files before locking behavior
**What goes wrong:** Teams rename, move, and reorganize files before pinning current behavior with tests and observability, which makes regressions harder to isolate.
**Warning signs:**
- A refactor PR is mostly moves/renames with little or no behavior pinning.
- Team members cannot quickly tell whether a regression came from logic change or file churn.
- The same subsystem gets reformatted and reshaped repeatedly before its contracts are stable.
**Prevention:** Add safety rails first, then refactor structure.
**Phase to address:** Phase 3: Boundary Extraction

### Pitfall 15: Treating CI green as proof that production is safe
**What goes wrong:** Typecheck, lint, unit tests, and build pass, but deployment-time config, provider credentials, cron auth, and runtime latency still break production behavior.
**Warning signs:**
- "CI passed" is used as the main release argument for operationally risky changes.
- Deploy-only issues recur around secrets, cron, redirects, or provider behavior.
- No one checks production-like smoke paths after a release.
**Prevention:** Add deploy checks, smoke checks, and production contract verification to the release process.
**Phase to address:** Phase 1: Operational Baseline and Phase 5: Delivery Discipline and Documentation

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Baseline observability | Instrumenting too late | Add route/job telemetry and alert hooks before refactors |
| Cron hardening | Reusing the current one-request orchestrator | Split jobs by responsibility and add durable retry semantics |
| Scheduling correctness | Fixing one bug without unifying date and recurrence policy | Create one schedule/date module contract and test concurrency paths |
| Service extraction | Moving code without clarifying ownership | Define service boundaries first, then migrate routes one seam at a time |
| Frontend cleanup | Cosmetic refactors of giant client pages | Split by state ownership and data-fetch scope, not by arbitrary JSX chunks |
| Testing upgrades | Adding broad slow tests everywhere | Add a thin high-value E2E and DB-backed layer only for critical flows |
| Documentation refresh | Copying old reviews into new plans | Re-verify every operational claim against current code and deploy config |

## Sources

### Internal sources
- `.planning/PROJECT.md` — project constraints and non-goals
- `.planning/codebase/CONCERNS.md` — current repo-specific debt, bugs, scaling limits, and fragile areas
- `.planning/codebase/TESTING.md` — testing strengths and blind spots
- `PROJECT_REVIEW.md` — useful historical signals, but some findings are now stale and required re-verification
- `docs/WORKFLOW.md` — branch, PR, and validation policy
- `package.json`, `vercel.json`, `.github/workflows/ci.yml`
- `src/lib/scheduler.ts`, `src/lib/jobs/cobranca-whatsapp.ts`, `src/lib/notification-delivery.ts`, `src/services/agendamento.service.ts`, `src/lib/rate-limit.ts`, `src/app/api/cron/tarefas-diarias/route.ts`, `src/app/api/notificacoes/route.ts`

### External sources
- Prisma transactions docs: https://www.prisma.io/docs/v6/orm/prisma-client/queries/transactions
  Confidence: HIGH
  Why used: Confirms transaction, isolation, and short-lived transaction guidance relevant to recurring schedule and notification mutations.
- Vercel cron jobs docs: https://vercel.com/docs/cron-jobs/manage-cron-jobs
  Confidence: HIGH
  Why used: Confirms current cron deployment model and `CRON_SECRET` guidance for secured scheduled invocations.
- Vercel observability docs: https://vercel.com/docs/observability
  Confidence: HIGH
  Why used: Supports the recommendation to establish runtime visibility before deep hardening work.
- Next.js OpenTelemetry guide: https://nextjs.org/docs/pages/guides/open-telemetry
  Confidence: MEDIUM
  Why used: Confirms native instrumentation support in Next.js, though the page is under the Pages Router docs tree and should be validated against the exact App Router setup used here.
- Next.js Vitest guide: https://nextjs.org/docs/app/guides/testing/vitest
  Confidence: HIGH
  Why used: Confirms the limitation of Vitest around async Server Components and supports adding E2E coverage for critical flows.
- AWS Prescriptive Guidance, Strangler Fig pattern: https://docs.aws.amazon.com/prescriptive-guidance/latest/modernization-decomposing-monoliths/strangler-fig.html
  Confidence: MEDIUM
  Why used: Supports the recommendation to modernize incrementally instead of treating hardening as a rewrite.
