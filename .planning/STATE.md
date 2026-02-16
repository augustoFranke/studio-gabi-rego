# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** The app must become production-hardened: secure against authorization bypasses, free of known bugs, performant under real usage, and protected by meaningful test coverage — without breaking any existing functionality.
**Current focus:** Phase 2 — Bug Fixes and Dependency Cleanup

## Current Position

Phase: 2 of 10 (Bug Fixes and Dependency Cleanup)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-02-16 — Completed 02-02 plan (BUG-02 explicit-null sexo contract)

Progress: [█░░░░░░░░░] 13%

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: ~23 min
- Total execution time: ~1.95 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 4 | ~1.9h | ~29m |
| 2 | 1 | ~2m | ~2m |

**Recent Trend:**
- Last 4 plans: 01-02, 01-03, 01-04, 02-02
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
- [Phase 2]: Anamnese GET endpoints now return explicit null for missing sexo and never infer from member names — prevents incorrect demographic data and keeps API behavior consistent across admin and token entry points

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 4]: Schedule Prisma index migration during off-hours — brief write lock on Pagamento/Agendamento tables
- [Phase 6]: Scheduler functions may need light extraction into pure functions before they can be unit-tested — assess during planning
- [Phase 7]: State ownership in financeiro/page.tsx must be mapped before extraction begins — hook rule violations will result otherwise
- [Phase 9]: Run vitest after each individual RSC conversion, not at end of phase — RSC conversion can break existing test mocks

## Session Continuity

Last session: 2026-02-16
Stopped at: Completed 02-02-PLAN.md — ready for remaining Phase 2 plans
Resume file: None
