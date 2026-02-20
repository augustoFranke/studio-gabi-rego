# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** The app must become production-hardened: secure against authorization bypasses, free of known bugs, performant under real usage, and protected by meaningful test coverage — without breaking any existing functionality.
**Current focus:** Phase 3 — Data Integrity

## Current Position

Phase: 3 of 10 (Data Integrity)
Plan: 1 of 3 in current phase
Status: Executing phase
Last activity: 2026-02-20 — Completed Phase 3 Plan 01 (canonical anamnese normalization + self-healing reads)

Progress: [███░░░░░░░] 23%

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: ~15 min
- Total execution time: ~2.1 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 4 | ~1.9h | ~29m |
| 2 | 3 | ~6m | ~2m |
| 3 | 1 | ~2m | ~2m |

**Recent Trend:**
- Last 4 plans: 02-01, 02-02, 02-03, 03-01
- Trend: Stable

*Updated after each plan completion*

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 4]: Schedule Prisma index migration during off-hours — brief write lock on Pagamento/Agendamento tables
- [Phase 6]: Scheduler functions may need light extraction into pure functions before they can be unit-tested — assess during planning
- [Phase 7]: State ownership in financeiro/page.tsx must be mapped before extraction begins — hook rule violations will result otherwise
- [Phase 9]: Run vitest after each individual RSC conversion, not at end of phase — RSC conversion can break existing test mocks

## Session Continuity

Last session: 2026-02-20
Stopped at: Completed 03-01-PLAN.md
Resume file: None
