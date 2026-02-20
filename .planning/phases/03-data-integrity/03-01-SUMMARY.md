---
phase: 03-data-integrity
plan: 01
subsystem: api
tags: [anamnese, data-integrity, normalization, prisma, vitest]
requires:
  - phase: 02-bug-fixes-and-dependency-cleanup
    provides: explicit-null sexo contract and stable anamnese endpoint baselines
provides:
  - canonical anamnese helper layer with sanitize + normalize primitives
  - minha-anamnese route migrated to shared sanitizer with tolerant unknown-key handling
  - admin/token anamnese GET self-healing normalization with conditional persistence
affects: [api, onboarding, testing]
tech-stack:
  added: []
  patterns: [single-source anamnese canonicalization, read-time self-healing writes]
key-files:
  created: []
  modified: [src/lib/anamnese.ts, src/app/api/minha-anamnese/route.ts, src/app/api/membros/[id]/anamnese/route.ts, src/app/api/anamnese-token/route.ts, src/__tests__/api/minha-anamnese.test.ts, src/__tests__/api/membros-id-anamnese.test.ts, src/__tests__/api/anamnese-token.test.ts]
key-decisions:
  - "Use fillMissingFields + ignoreUnknownFields options to enforce tolerant canonical writes"
  - "Persist self-heal updates only when normalization reports changed=true"
patterns-established:
  - "Anamnese routes consume shared canonical helpers, not route-local field maps"
  - "GET handlers normalize persisted data before response and conditionally patch storage"
duration: 2 min
completed: 2026-02-20
---

# Phase 3 Plan 01: Data Integrity Summary

**Canonical anamnese normalization now drives all entry points, with tolerant writes and self-healing read persistence in admin/token flows.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T09:09:21-04:00
- **Completed:** 2026-02-20T09:11:40-04:00
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Expanded `src/lib/anamnese.ts` into a reusable canonical layer with sanitize options, normalization metadata, and extraction helpers.
- Removed duplicated field mapping logic from `/api/minha-anamnese` and routed POST persistence through shared canonical sanitization.
- Added read-time normalization plus conditional self-healing updates to `/api/membros/[id]/anamnese` and `/api/anamnese-token` GET handlers.
- Updated anamnese API test suites to validate unknown-key tolerance and self-heal update behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Promote src/lib/anamnese.ts to full canonical sanitize and normalize layer** - `c0d7bfe` (feat)
2. **Task 2: Remove route-local ANAMNESE_FIELDS duplication from minha-anamnese route** - `a6e2033` (fix)
3. **Task 3: Add read-time self-healing normalization for admin and token anamnese endpoints** - `27738e2` (feat)

## Files Created/Modified
- `src/lib/anamnese.ts` - Canonical field key export, configurable sanitizer behavior, normalization helpers, and extraction utility.
- `src/app/api/minha-anamnese/route.ts` - POST path now uses shared tolerant sanitization and logs ignored keys.
- `src/app/api/membros/[id]/anamnese/route.ts` - GET path normalizes and self-heals changed payloads; POST now tolerates unknown keys.
- `src/app/api/anamnese-token/route.ts` - GET path normalizes and self-heals changed payloads; POST now tolerates unknown keys.
- `src/__tests__/api/minha-anamnese.test.ts` - Added assertions for canonical null defaults and unknown-key tolerance.
- `src/__tests__/api/membros-id-anamnese.test.ts` - Added self-heal GET coverage and updated unknown-key expectations.
- `src/__tests__/api/anamnese-token.test.ts` - Added self-heal GET coverage and tolerant POST payload case.

## Decisions Made
- Introduced option-based sanitizer behavior so routes can opt into tolerant payload handling without breaking strict call sites.
- Implemented self-healing writes only when normalization changes data to avoid unnecessary updates on every GET.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Focused tests initially failed after unknown-key tolerance because one test expected strict rejection and another assumed narrow update payload shape; both were corrected to align with the new canonical contract.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Canonical anamnese data behavior is in place for all relevant routes.
- Phase 3 Plan 02 can safely introduce nullable member emails with reduced risk of data-shape drift in anamnese flows.

## Self-Check: PASSED
- Verified `src/lib/anamnese.ts` and route/test artifacts exist.
- Verified task commits `c0d7bfe`, `a6e2033`, and `27738e2` exist in git history.

---
*Phase: 03-data-integrity*
*Completed: 2026-02-20*
