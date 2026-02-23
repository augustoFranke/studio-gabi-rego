# Studio Gabi Rego — Hardening & Performance

## What This Is

A comprehensive quality and performance improvement initiative for Studio Gabi Rego, an existing gym management system built with Next.js 16, Prisma, and Supabase. The app manages members, training sheets, scheduling, payments, and notifications for a Brazilian fitness studio. This milestone addresses all technical concerns from the codebase audit and adds performance optimizations across the full stack.

## Core Value

The app must become production-hardened: secure against authorization bypasses, free of known bugs, performant under real usage, and protected by meaningful test coverage — without breaking any existing functionality.

## Requirements

### Validated

- ✓ Member CRUD (create, read, update, delete, status toggle) — existing
- ✓ Training sheet management with PDF generation — existing
- ✓ Scheduling system with recurring appointments — existing
- ✓ Payment tracking and plan management — existing
- ✓ Email notifications via Resend (7 templates) — existing
- ✓ WhatsApp payment reminders via Evolution API — existing
- ✓ Credential-based auth with JWT sessions (NextAuth v5) — existing
- ✓ Role-based access control (ADMIN / MEMBRO) — existing
- ✓ Anamnese (health questionnaire) with token-based public access — existing
- ✓ Cron jobs for automated reminders and overdue payment updates — existing
- ✓ API test suite (45 test files, 226 tests passing) — existing

### Active

- [ ] Fix all security vulnerabilities identified in audit
- [ ] Fix all known bugs (revalidation paths, dead code)
- [ ] Reduce tech debt (split giant components, deduplicate code, remove unused deps)
- [ ] Add missing database indexes for query performance
- [ ] Convert client components to React Server Components where possible
- [ ] Implement SWR caching with deduplication across data-fetching pages
- [ ] Optimize bundle size (remove unused deps, lazy load heavy components)
- [ ] Add pagination to all unpaginated API endpoints
- [ ] Add test coverage for middleware, scheduler logic, and critical workflows
- [ ] Optimize birthday query to filter at database level

### Out of Scope

- New features (no new functionality, only fix and optimize existing) — scope creep risk
- E2E tests with Playwright — valuable but separate initiative
- Structured logging / error tracking (Sentry) — infrastructure decision, separate milestone
- Audit log for admin operations — new feature, not a fix
- Migration from NextAuth v5 beta to stable — wait for stable release
- UI redesign or UX changes — visual changes not in scope

## Context

- **Domain:** Gym management for Studio Gabi Rego (Brazilian fitness studio)
- **Language:** Brazilian Portuguese throughout codebase and UI
- **Production:** Deployed on Vercel (gru1 region), Supabase PostgreSQL (sa-east-1)
- **Codebase size:** ~15,000 lines of application code across 14 Prisma models, 30+ API routes, 10+ pages
- **Current test suite:** 226 unit/integration tests covering API routes, schemas, services, and PDF generation. Zero coverage on client components, middleware, and scheduler logic.
- **Key pain points from audit:**
  - Server actions lack auth checks (security)
  - Rate limiter fails open in production (security)
  - Cron secrets use non-constant-time comparison (security)
  - Password policy inconsistency between registration and admin flows (security)
  - 1,612-line financeiro page and 785-line treinos generator (maintainability)
  - 948-line email template file with 7 duplicated HTML layouts (maintainability)
  - Duplicated anamnese field definitions (data integrity risk)
  - Incorrect revalidatePath calls (bug)
  - No database indexes beyond Prisma defaults (performance)
  - Client-side data fetching on financeiro without SWR (performance)
  - Birthday query loads all members into memory (performance)
  - Unused dependencies: pdf-lib, dompurify, isomorphic-dompurify (bundle size)

## Constraints

- **Zero regressions:** All 226 existing tests must continue to pass after every change
- **Tech stack:** Stay within current stack (Next.js 16, Prisma, Supabase, Vercel) — no new frameworks
- **Backwards compatible:** No database schema changes that break existing data
- **Incremental:** Each phase must leave the app in a working, deployable state

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fix security before refactoring | Auth gaps are exploitable in production now | — Pending |
| Keep NextAuth v5 beta | No stable v5 available, current impl is simple | — Pending |
| Use SWR for client data fetching | Already a dependency, well-suited for this app | — Pending |
| Remove unused deps rather than implement them | dompurify/pdf-lib not needed — existing sanitization is sufficient | — Pending |

---
*Last updated: 2026-02-16 after initialization*
