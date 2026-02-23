# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** The app must become production-hardened: secure against authorization bypasses, free of known bugs, performant under real usage, and protected by meaningful test coverage — without breaking any existing functionality.
**Current focus:** Phase 5 — API Pagination

## Current Position

Phase: 4 of 10 (Database Performance)
Plan: 3 of 3 in current phase
Status: Phase 4 complete; PERF-01 and PERF-02 now have regression and verification coverage
Last activity: 2026-02-20 — Completed 04-03 execution (scheduler regressions + post-migration verification gate)

Progress: [████░░░░░░] 40%

## Performance Metrics

**Velocity:**
- Total plans completed: 13
- Average duration: ~10 min
- Total execution time: ~2.3 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 4 | ~1.9h | ~29m |
| 2 | 3 | ~6m | ~2m |
| 3 | 3 | ~4m | ~1m |
| 4 | 3 | ~9m | ~3m |

**Recent Trend:**
- Last 4 plans: 03-03, 04-01, 04-02, 04-03
- Trend: Stable

*Updated after each plan completion*

**Recent executions:**
- Phase 04 P03 | 2 min | 2 tasks | 1 file
- Phase 04 P02 | 2 min | 2 tasks | 1 file
- Phase 04 P01 | 5 min | 2 tasks | 2 files

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Security before refactoring — three server action exploits are callable by any authenticated session today
- [Roadmap]: Component split (Phase 7) must precede SWR caching (Phase 8) — SWR cannot be added to a 1,612-line monolith
- [Roadmap]: Test coverage (Phase 6) must precede structural refactoring (Phase 7-10) — tests are the safety net for those changes
- [Roadmap]: pdf-lib moves to devDependencies (not deleted) — confirmed used in test fixtures
- [Phase 1]: Server actions now use shared ADMIN-only guard and generic Unauthorized response contract
- [Phase 1]: Rate limiter is fail-closed in production outages with standardized payload
- [Phase 1]: Cron auth now uses shared `timingSafeEqual` validator across both cron routes
- [Phase 1]: Password policy is centralized in shared schema and enforced across registration/member flows
- [Phase 2]: Member mutation server actions now revalidate `/alunos` consistently, with regression assertions for toggle/delete/deactivate flows
- [Phase 2]: Anamnese GET endpoints now return explicit null for missing sexo and never infer from member names — prevents incorrect demographic data and keeps API behavior consistent across admin and token entry points
- [Phase 2]: Dependency cleanup moved `pdf-lib` to devDependencies and removed unused dompurify packages, with successful test/build verification
- [Phase 03]: Use fillMissingFields + ignoreUnknownFields to enforce tolerant canonical anamnese writes
- [Phase 03]: Persist anamnese self-heal updates only when normalization reports changed=true
- [Phase 03]: Missing member email is persisted as null in create/update routes instead of synthetic placeholder addresses
- [Phase 03]: Outbound email flows must guard nullable recipients and skip send attempts when email is absent
- [Phase 03]: Placeholder-email cleanup uses deterministic preview/execute modes with JSON reports and non-destructive inspection behavior
- [Phase 04]: Birthday member filtering now runs in parameterized SQL using EXTRACT(MONTH/DAY) instead of in-memory JS filtering.
- [Phase 04]: Birthday SQL rows are mapped back to the existing membro.usuario shape to keep notification dedupe/send behavior unchanged.
- [Phase 04-database-performance]: Used Prisma datamodel diff fallback to generate scoped PERF-01 migration SQL when local DB was unavailable.
- [Phase 04-database-performance]: Deploy Phase 4 index migration during off-hours to reduce impact of brief CREATE INDEX write locks.
- [Phase 04-database-performance]: Scheduler PERF regressions now assert prisma.$queryRaw usage, same-day dedupe, and send guards.

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 4]: Schedule Prisma index migration during off-hours — brief write lock on Pagamento/Agendamento tables
- [Phase 6]: Scheduler functions may need light extraction into pure functions before they can be unit-tested — assess during planning
- [Phase 7]: State ownership in financeiro/page.tsx must be mapped before extraction begins — hook rule violations will result otherwise
- [Phase 9]: Run vitest after each individual RSC conversion, not at end of phase — RSC conversion can break existing test mocks

## Session Continuity

Last session: 2026-02-20
Stopped at: Completed 04-03-PLAN.md
Resume file: None
