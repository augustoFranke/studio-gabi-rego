---
phase: 02-bug-fixes-and-dependency-cleanup
plan: 02
subsystem: api
tags: [anamnese, api, prisma, vitest]
requires:
  - phase: 01-security-hardening
    provides: hardened auth and validation baseline
provides:
  - admin anamnese GET returns null sexo when DB sexo is unset
  - token anamnese GET returns null sexo when DB sexo is unset
  - regression tests enforce explicit-null sexo contract in both endpoints
affects: [api, testing, onboarding]
tech-stack:
  added: []
  patterns: [db-only sexo contract, explicit null fallback]
key-files:
  created: []
  modified: [src/app/api/membros/[id]/anamnese/route.ts, src/app/api/anamnese-token/route.ts, src/__tests__/api/membros-id-anamnese.test.ts, src/__tests__/api/anamnese-token.test.ts]
key-decisions:
  - "Both anamnese GET endpoints must rely only on persisted DB sexo values"
  - "Unset sexo is represented as null, never inferred from names"
patterns-established:
  - "Anamnese response contracts use explicit null fallback for missing sexo"
duration: 2 min
completed: 2026-02-16
---

# Phase 2 Plan 02: Bug Fixes and Dependency Cleanup Summary

**Both anamnese GET endpoints now return explicit-null sexo when the database field is unset, with all name-based inference removed and regression tests enforcing the contract.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T15:41:34Z
- **Completed:** 2026-02-16T15:44:04Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Removed sexo heuristic fallback logic from `GET /api/membros/[id]/anamnese`.
- Removed sexo heuristic fallback logic from `GET /api/anamnese-token` while preserving token/cookie behavior.
- Updated both API test suites to assert `null` sexo for missing DB values.

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove sexo heuristic fallback from admin anamnese endpoint** - `fc5edc4` (fix)
2. **Task 2: Remove sexo heuristic fallback from token anamnese endpoint** - `e28fb1c` (fix)
3. **Task 3: Update endpoint tests to enforce explicit-null sexo contract** - `4521a26` (test)

## Files Created/Modified
- `src/app/api/membros/[id]/anamnese/route.ts` - GET now maps stored sexo values and returns `null` when unset.
- `src/app/api/anamnese-token/route.ts` - GET now returns `membro.sexo ?? null` and removes inference helpers.
- `src/__tests__/api/membros-id-anamnese.test.ts` - Missing-sexo regression asserts `json.member.sexo` is `null`.
- `src/__tests__/api/anamnese-token.test.ts` - Missing-sexo regression asserts `json.sexo` is `null`.

## Decisions Made
- Applied BUG-02 consistently across both anamnese GET entry points to prevent contract drift.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Plan `02-02` is complete and verified; ready for `02-03-PLAN.md`.

---
*Phase: 02-bug-fixes-and-dependency-cleanup*
*Completed: 2026-02-16*
