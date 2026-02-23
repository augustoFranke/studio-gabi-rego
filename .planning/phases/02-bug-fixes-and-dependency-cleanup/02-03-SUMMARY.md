---
phase: 02-bug-fixes-and-dependency-cleanup
plan: 03
subsystem: infra
tags: [dependencies, npm, build, vitest]
requires:
  - phase: 01-security-hardening
    provides: stable baseline for mutation/auth contracts
provides:
  - dompurify and isomorphic-dompurify removed from production dependencies
  - pdf-lib retained only in devDependencies for test-time usage
  - dependency cleanup validated by targeted PDF test and production build
affects: [api, build, testing]
tech-stack:
  added: []
  patterns: [runtime-vs-dev dependency hygiene, build-gated dependency cleanup]
key-files:
  created: []
  modified: [package.json, package-lock.json, src/components/admin/member-actions.tsx, src/lib/auth.ts]
key-decisions:
  - "Treat build-break regressions surfaced during verification as auto-fix blockers before closing SEC-05"
  - "Keep pdf-lib as dev-only because usage is test-scoped"
patterns-established:
  - "Dependency cleanup requires proof via targeted tests and production build"
duration: 2 min
completed: 2026-02-16
---

# Phase 2 Plan 03: Bug Fixes and Dependency Cleanup Summary

**Production dependency surface is reduced by removing unused DOM sanitizers and relocating `pdf-lib` to devDependencies, with build verification restored after two auto-fixed type blockers.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T15:47:38Z
- **Completed:** 2026-02-16T15:49:33Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Confirmed dependency usage scope: `pdf-lib` is test-only and no runtime imports exist for `dompurify` packages.
- Removed `dompurify` and `isomorphic-dompurify` from `dependencies` and moved `pdf-lib` to `devDependencies`.
- Revalidated SEC-05 with `src/__tests__/pdf/generation.test.ts` and successful `npm run build`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Audit repository imports for targeted dependency cleanup** - `67bd64b` (chore)
2. **Task 2: Update dependency manifest and lockfile to reflect SEC-05** - `fbc7b0b` (chore)
3. **Task 3: Run regression checks for PDF test path and application build** - `bacb2a5` (fix)

## Files Created/Modified
- `package.json` - Removed `dompurify` + `isomorphic-dompurify` from runtime deps and moved `pdf-lib` to devDeps.
- `package-lock.json` - Synced lockfile with updated dependency graph.
- `src/components/admin/member-actions.tsx` - Updated error toasts to use `result.message` return contract.
- `src/lib/auth.ts` - Added explicit cached auth session return signature to satisfy build-time typing.

## Decisions Made
- Allowed narrow auto-fix scope for build blockers discovered during SEC-05 verification so plan verification could complete.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed stale server-action error payload usage in member actions**
- **Found during:** Task 3 (build verification)
- **Issue:** Build failed because `member-actions.tsx` referenced `result.error`, but server actions return `{ success, message }`.
- **Fix:** Switched toast fallback lookups to `result.message`.
- **Files modified:** `src/components/admin/member-actions.tsx`
- **Verification:** `npm run build` progressed past previous type error.
- **Committed in:** `bacb2a5`

**2. [Rule 3 - Blocking] Fixed cached auth typing mismatch that broke production build**
- **Found during:** Task 3 (build verification)
- **Issue:** `cache(nextAuth.auth)` inferred an incompatible overload, causing `server-action-auth.ts` type failure during build.
- **Fix:** Wrapped auth export with explicit `Session | null` async signature before caching.
- **Files modified:** `src/lib/auth.ts`
- **Verification:** `npm run build` completed successfully.
- **Committed in:** `bacb2a5`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes were required for successful verification; no scope creep outside build-blocking correctness.

## Issues Encountered
- Initial build verification failed twice on existing typing drift in adjacent files; both issues were corrected in-place and revalidated.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
SEC-05 is completed and verified; Phase 2 can proceed to phase-level goal verification.

---
*Phase: 02-bug-fixes-and-dependency-cleanup*
*Completed: 2026-02-16*
