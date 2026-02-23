---
phase: 03-data-integrity
plan: 02
subsystem: database
tags: [prisma, members-api, nullable-email, scheduler, typecheck]
requires:
  - phase: 03-data-integrity
    provides: canonical anamnese behavior from plan 01
provides:
  - Usuario.email nullable model with explicit migration
  - member create/update APIs persisting null instead of placeholder addresses
  - null-safe guards for email-dependent scheduler and reset-email flows
affects: [api, auth, scheduler, database]
tech-stack:
  added: []
  patterns: [nullable email domain model, guarded outbound email delivery]
key-files:
  created: [prisma/migrations/20260220101500_usuario_email_nullable/migration.sql]
  modified: [prisma/schema.prisma, src/app/api/membros/route.ts, src/app/api/membros/[id]/route.ts, src/lib/email.ts, src/lib/scheduler.ts, src/app/api/auth/enviar-reset-senha/route.ts, src/__tests__/api/membros.test.ts, src/__tests__/api/membros-id.test.ts]
key-decisions:
  - "Treat missing member email as first-class null at write boundaries"
  - "Guard all email sends when recipient email is absent instead of attempting delivery"
patterns-established:
  - "Member API routes normalize email for storage and never synthesize placeholder addresses"
  - "Nullable email migrations require immediate typecheck-driven guard fixes across send paths"
duration: 1 min
completed: 2026-02-20
---

# Phase 3 Plan 02: Data Integrity Summary

**Member email handling now uses explicit nullable storage end-to-end, replacing placeholder generation with guarded email-dependent behavior.**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-20T09:15:59-04:00
- **Completed:** 2026-02-20T09:16:27-04:00
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Made `Usuario.email` nullable in Prisma schema and added explicit SQL migration to drop the non-null constraint safely.
- Removed placeholder email generation from both member create and update routes, persisting `null` when email is missing/cleared.
- Added storage normalization helpers in `src/lib/email.ts` and regression tests for null-email member flows.
- Added null-email guards in scheduler and admin reset-email route so send flows fail safely without attempting invalid sends.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make Usuario.email nullable with explicit Prisma migration** - `97c59af` (chore)
2. **Task 2: Remove placeholder email generation from member create/update APIs** - `566c8aa` (fix)
3. **Task 3: Guard email-dependent scheduler flows for null-email members** - `ee80de6` (fix)

## Files Created/Modified
- `prisma/schema.prisma` - `Usuario.email` converted to optional unique field.
- `prisma/migrations/20260220101500_usuario_email_nullable/migration.sql` - Drops `usuarios.email` NOT NULL constraint.
- `src/app/api/membros/route.ts` - Member creation path now persists `email: null` when absent.
- `src/app/api/membros/[id]/route.ts` - Member update path now clears email to `null` and updates user even when clearing only.
- `src/lib/email.ts` - Added storage normalization helpers and placeholder detection utility.
- `src/lib/scheduler.ts` - Added guards to skip email sends when member email is missing.
- `src/app/api/auth/enviar-reset-senha/route.ts` - Added guard for reset-email attempts against users without email.
- `src/__tests__/api/membros.test.ts` - Added null-email creation regression test.
- `src/__tests__/api/membros-id.test.ts` - Added null-email clearing regression test.

## Decisions Made
- Nullable email became the canonical missing-email representation in member APIs.
- Outbound email paths must short-circuit when recipient email is null to preserve runtime safety after schema change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed typecheck blocker in admin password reset email route**
- **Found during:** Task 1 verification (`npm run db:generate && npm run typecheck`)
- **Issue:** Nullable `usuario.email` broke `enviar-reset-senha` route typing and would allow attempting send with null recipient.
- **Fix:** Added explicit null-email guard returning `400` before email send.
- **Files modified:** `src/app/api/auth/enviar-reset-senha/route.ts`
- **Verification:** `npm run typecheck`
- **Committed in:** `ee80de6`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for successful nullable-email compile/runtime safety; no scope creep beyond email-dependent guardrail.

## Issues Encountered
- Prisma nullable-email update introduced immediate type-check breakages in non-member email flows; resolved with null guards in the same plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Member email domain model is now nullable and safe for legacy cleanup operations.
- Phase 3 Plan 03 can run deterministic placeholder-email migration against a compatible schema.

## Self-Check: PASSED
- Verified migration artifact and key API files exist on disk.
- Verified task commits `97c59af`, `566c8aa`, and `ee80de6` exist in git history.

---
*Phase: 03-data-integrity*
*Completed: 2026-02-20*
