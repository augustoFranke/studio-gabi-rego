# Research Summary: Studio Gabi Rego — Hardening & Performance Milestone

**Synthesized:** 2026-02-16
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
**Synthesizer:** gsd-research-synthesizer

---

## Executive Summary

The Studio Gabi Rego app is a functioning Next.js 16 gym management system with an existing user base. This milestone is not greenfield development — it is a production hardening and technical quality pass on a live application. The research confirms three active security vulnerabilities (unauthenticated server actions, fail-open rate limiter, and non-timing-safe cron secret comparison) that are exploitable today and must be addressed before any other work begins. These are not theoretical risks: the server action exposure allows any logged-in member to delete or deactivate other members with a single POST request.

Beyond security, the codebase has two dominant structural problems. First, the data-fetching layer is inconsistent: some pages correctly use RSC with direct Prisma queries (alunos, dashboard), while other pages are 1,600-line monolithic `"use client"` files doing manual `useEffect`-based fetches with no caching, no deduplication, and manual race-condition workarounds. Second, shared logic is duplicated rather than extracted: 948 lines of email templates repeat the same 80-line HTML wrapper 7 times; anamnese field definitions exist in two separate files; placeholder email generation uses slightly different patterns in two API routes. The recommended approach is security first, then data integrity and DB performance, then test coverage, then structural refactoring — in that order.

The overall confidence in this research is HIGH. Every finding is grounded in either official documentation (Next.js, Prisma, SWR) or direct codebase analysis. The existing stack (Next.js 16.1.1, Prisma 6, Supabase, Vitest, SWR, Zod 4) is sound and requires only targeted additions, not replacement. The primary execution risk is the financeiro page refactor (1,612 lines, mixed state ownership) — that work requires careful dependency mapping before any extraction begins or React hook rule violations will result.

---

## Key Findings

### From STACK.md — Technology Additions Required

The existing stack is correct and should not change. Four targeted additions are recommended:

| Package | Purpose | Confidence |
|---------|---------|------------|
| `next-safe-action ^8.0.11` | Structural server action auth enforcement via middleware chain | HIGH |
| `@testing-library/react ^16.3.2` + supporting packages | Client component test coverage in Vitest jsdom environment | HIGH |
| `@next/bundle-analyzer ^16.1.6` | Data-driven dependency removal (verify before removing pdf-lib etc.) | HIGH |
| `react-email ^5.2.8` + `@react-email/components` | Replace 948-line HTML email blob with composable components | HIGH |

Three security fixes require zero new dependencies: rate limiter fail-closed uses a `NODE_ENV` guard in existing code; timing-safe cron comparison uses Node.js built-in `crypto.timingSafeEqual`; password policy unification uses Zod 4 (already installed). Three likely-unused dependencies (`pdf-lib`, `dompurify`, `isomorphic-dompurify`) should be verified via bundle analyzer before removal — `pdf-lib` is confirmed used in test files and should move to `devDependencies`, not be deleted outright.

Critical version note: A second Vitest config (`vitest.jsdom.config.ts`) with jsdom environment is required for client component tests. Async RSC components cannot be unit-tested with Vitest in early 2026 — this is a fundamental limitation, not a gap in the approach.

### From FEATURES.md — Work Item Inventory

**Table stakes (must ship — active security or confirmed bugs):**
- Server action auth checks in `src/app/actions/membros.ts` (3 functions, zero role checks)
- Rate limiter fail-closed (`src/lib/rate-limit.ts` lines 37–42)
- Timing-safe cron secret comparison (both cron route handlers)
- Unified password policy (Zod schema extraction)
- Fix `revalidatePath('/membros')` to `revalidatePath('/alunos')` — confirmed broken behavior today
- Remove unused dependencies (after bundle analyzer verification)
- Composite database indexes on Pagamento, Membro, Agendamento
- Centralize anamnese field definition (data loss risk on future field additions)
- Centralize placeholder email generation (silent drift risk)
- Tests for middleware route protection
- Tests for scheduler core logic

**Differentiators (high value but not active production risks):**
- Split financeiro page component (1,612 lines — prerequisite for SWR adoption)
- SWR caching on financeiro (requires split first)
- Split treinos gerador page (785 lines)
- Deduplicate email templates with react-email
- Birthday query at database level (in-memory full-table scan today)
- Pagination for currently unpaginated endpoints

**Explicitly deferred (anti-features for this milestone):**
- Playwright E2E tests (infrastructure dependencies out of scope)
- Sentry / structured logging (GDPR/billing decision, separate milestone)
- Audit log for admin operations (net-new feature, not a bug fix)
- NextAuth v5 stable migration (no stable v5 exists)
- Major component library migration (visual regression risk, no benefit)

### From ARCHITECTURE.md — Structural Patterns

The recommended layer structure is clear and consistent with what already works in the codebase:

- **RSC** for page shells, static data sections, and list pages filtered by URL params (alunos, dashboard already correct)
- **SWR client components** for interactive tables, filtered/paginated lists, and any data that updates after mutations
- **API routes** for mutations only (POST/PUT/PATCH/DELETE) — paginated list endpoints consumed by SWR
- **Services layer** for business logic with side effects (email, WhatsApp, PDF)

The financeiro refactor has a defined build order: extract dialogs first (lowest risk), then pagamentos table, then planos section, then convert the page shell to RSC. The RSC shell conversion must be last — attempting it before the client islands are independently defined fails.

For email templates, the pattern is a `base-layout.ts` function that extracts the common 80-line HTML wrapper. Each of the 7 templates becomes a ~30-line file passing only unique content. This eliminates 7-way duplication without requiring react-email if the team prefers to minimize new dependencies.

Key SWR implementation note: every mutation must call `mutate(key)` to invalidate the SWR client cache. `revalidatePath` in API route handlers only clears the Next.js server-side router cache — it does not flush SWR's client-side cache. Using both systems without pairing them produces stale UI after deletes and updates.

### From PITFALLS.md — Risk Register

**Critical pitfalls (cause security regression or require rewrites if triggered):**

1. **Server actions are not protected by middleware** — middleware guards page navigation only. Any `'use server'` function without an explicit `auth()` call is a public API endpoint callable by any session holder. This is an active vulnerability, not a hypothetical.

2. **Prisma CONCURRENTLY + transaction block incompatibility** — adding multiple `@@index` declarations in one migration wraps them in a PostgreSQL transaction, preventing `CONCURRENTLY`. For this app's scale (hundreds of rows), the brief write lock during index creation is acceptable but must be scheduled during off-hours to avoid user impact.

3. **RSC conversion breaks existing Vitest tests** — converting pages from `'use client'` to RSC changes the import chain for `auth()` and Next.js server-only APIs. Existing test mocks may stop applying. Run `test:run` after every individual conversion, not at end of phase.

4. **SWR cache and Next.js router cache are independent** — mutations must call `mutate()` for client-side cache invalidation in addition to any `revalidatePath` calls. Missing this produces stale UI that confuses admins.

**Moderate pitfalls to manage:**
- Extracting financeiro sub-components without mapping shared state first causes hook rule violations
- `pdf-lib` is used in test fixtures — move to `devDependencies` before removing, do not delete
- Rate limiter fail-open is silent in production — add health check endpoint for monitoring
- `$queryRaw` for birthday query fix loses Prisma type inference — define explicit result type

---

## Implications for Roadmap

### Suggested Phase Structure

Research from all four files converges on the same phase ordering. The dependency graph is clear.

---

**Phase 1 — Security Hardening** (all standalone fixes, no dependencies)

*Rationale:* Three of these are exploitable today. They are all low-complexity, standalone changes. Shipping Phase 1 without Phase 2 is a safe, complete deliverable. Shipping Phase 2 or 3 without Phase 1 is irresponsible.

*Delivers:* App is no longer exploitable by authenticated members; rate limiting is reliable in production; cron endpoints resist timing attacks; password policy is consistent.

*Features:*
- Server action auth checks (`src/app/actions/membros.ts`)
- Rate limiter fail-closed (`src/lib/rate-limit.ts`)
- Timing-safe cron comparison (both cron routes)
- Unified password policy (shared Zod schema)
- Fix `revalidatePath('/membros')` to `revalidatePath('/alunos')`

*Pitfalls to avoid:* Pitfall 1 (server action auth), Pitfall 8 (rate limiter silence), Pitfall 9 (cron comparison), Pitfall 10 (password schema breaks existing tests — update tests in same commit), Pitfall 6 (wrong revalidatePath slug).

*Research flag:* No deeper research needed. All fixes are well-documented patterns.

---

**Phase 2 — Data Integrity and DB Performance** (low-risk, high-value infrastructure)

*Rationale:* Database indexes have zero code risk and provide immediate query improvements. Centralizing duplicated definitions eliminates future data-loss risk. These changes are data-layer only — no UI surface area to regress.

*Delivers:* Financeiro and scheduling queries stop scanning full tables; anamnese and email generation logic are single-source-of-truth.

*Features:*
- Composite Prisma `@@index` additions (Pagamento, Agendamento, Notificacao, FichaTreino, Membro)
- Centralize anamnese field definition
- Centralize placeholder email generation
- Remove unused dependencies (`dompurify`, `isomorphic-dompurify` — after bundle analyzer; `pdf-lib` to devDependencies)
- Birthday query moved to database level (`$queryRaw`)

*Pitfalls to avoid:* Pitfall 2 (CONCURRENTLY in transaction — schedule migration off-hours), Pitfall 7 (pdf-lib in tests — move to devDependencies), Pitfall 11 (redundant FK indexes — inspect pg_indexes before adding), Pitfall 14 (queryRaw loses type safety — define result type).

*Research flag:* No deeper research needed. Prisma index patterns are well-documented.

---

**Phase 3 — Test Coverage** (close gaps in middleware and scheduler)

*Rationale:* Middleware and scheduler are the highest-risk untested paths. Middleware misconfiguration is a single-character auth bypass. Scheduler bugs send duplicate notifications to all members. Phase 3 must come before Phase 4 (structural refactoring) because tests are the safety net for the refactor.

*Delivers:* Verified auth route protection with automated regression coverage; scheduler deduplication and member filtering confirmed by tests; jsdom test environment available for all future client component work.

*Features:*
- Install testing infrastructure (`@testing-library/react`, jsdom, second Vitest config)
- Tests for middleware route protection (admin vs member vs unauthenticated)
- Tests for scheduler core logic (deduplication, filtering, status transitions)

*Pitfalls to avoid:* Pitfall 3 (RSC test environment — configure jsdom config before writing RSC-related tests), Pitfall 13 (middleware array omission — assert all known admin routes in tests).

*Research flag:* May need phase research on jsdom Vitest setup with Next.js App Router mocking patterns. STACK.md provides the package list but the mock configuration for `next/headers` and `next/cache` in the jsdom environment may require iteration.

---

**Phase 4 — Structural Refactoring** (maintainability and performance)

*Rationale:* With security hardened and tests in place, the large structural changes are safe to execute. Start with treinos gerador (785 lines) to prove the RSC + SWR pattern before tackling financeiro (1,612 lines). Email deduplication is self-contained and can run in parallel with component splitting.

*Delivers:* Financeiro and treinos pages are independently testable; SWR provides deduplication and caching for the most-used admin pages; email templates are maintainable without 7-way edits; bundle size reduced by component splitting.

*Features:*
- Split treinos gerador page (member-selector, template-selector, session-builder as separate components)
- Split financeiro page (dialogs first, then tables, then RSC shell conversion)
- SWR caching on financeiro (after split)
- Deduplicate email templates (react-email or base-layout extraction)

*Pitfalls to avoid:* Pitfall 3 (RSC conversion breaks tests — run test:run after each conversion), Pitfall 4 (SWR mutation cache — pair every mutation with mutate()), Pitfall 5 (hook rule violations — map shared state before extracting components), Pitfall 12 (email HTML structure change breaks email clients — visual test all 7 templates).

*Research flag:* Needs phase research for financeiro component splitting. State ownership mapping for the 1,612-line component requires detailed codebase analysis before implementation begins. Do not start Phase 4 implementation without that analysis.

---

### Feature Dependency Summary

```
Phase 1 items — all independent of each other and everything else

Phase 2 items — independent; birthday query can run standalone
  Remove deps → requires bundle analyzer (install at Phase 2 start)
  DB indexes → must be verified against existing pg_indexes first

Phase 3 items — independent
  Scheduler tests → may require light scheduler function extraction first

Phase 4 — strict internal ordering:
  treinos gerador split → proves pattern for financeiro
  financeiro split → prerequisite for financeiro SWR
  financeiro RSC shell → must be last step of financeiro split
  email dedup → independent of component splits
```

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Security vulnerabilities | HIGH | Direct codebase analysis confirms all three active exploits |
| Technology additions | HIGH | All packages verified on npm registry; official docs consulted |
| Architecture patterns | HIGH | SWR and RSC patterns verified against official Vercel/Next.js docs |
| Database index strategy | HIGH | Prisma index docs + PostgreSQL docs; Supabase-specific behavior confirmed |
| Component splitting approach | MEDIUM | Pattern is correct; exact state ownership in financeiro requires hands-on analysis |
| Email deduplication | HIGH | react-email is Resend's own recommended library; integration path is first-class |
| Test environment setup | HIGH | Official Next.js Vitest guide followed exactly |
| Pitfall identification | HIGH | All critical pitfalls grounded in official docs or direct codebase analysis |

**Overall confidence: HIGH**

---

## Gaps to Address During Planning

1. **Financeiro state ownership map** — before Phase 4 begins, someone must trace all `useState`, `useCallback`, and `useRef` calls in `financeiro/page.tsx` and produce a dependency diagram. This is a planning prerequisite, not a research gap. The architecture pattern is clear; the specific state topology in this 1,612-line file is not documented.

2. **Scheduler function extractability** — `processarAniversarios`, `processarCobrancas`, and overdue-update logic need to be assessed for how easily they can be extracted into pure, testable functions. If they depend heavily on module-level side effects, the extraction itself becomes a Phase 3 sub-task.

3. **Supabase production index inspection** — before adding Prisma `@@index` declarations, run `\d pagamentos`, `\d agendamentos`, etc. on the live Supabase database to confirm which indexes already exist. Prisma may have created implicit indexes not reflected in schema.prisma. Do not add redundant indexes.

4. **Pagination UX decision** — `/api/membros`, `/api/horarios`, `/api/planos` return all records. Adding pagination is deferred from this milestone but the decision on page size, cursor vs offset, and UI (load-more vs page numbers) should be made before any SWR work on these endpoints in Phase 4.

---

## Aggregated Sources

- [Next.js: How to Think About Security in Next.js](https://nextjs.org/blog/security-nextjs-server-components-actions) — HIGH confidence
- [Next.js: Data Security Guide](https://nextjs.org/docs/app/guides/data-security) — HIGH confidence
- [Next.js: Production Checklist](https://nextjs.org/docs/app/guides/production-checklist) — HIGH confidence
- [Next.js official Vitest testing guide](https://nextjs.org/docs/app/guides/testing/vitest) — HIGH confidence
- [Next.js bundle analyzer official docs](https://nextjs.org/docs/app/guides/package-bundling) — HIGH confidence
- [SWR: Usage with Next.js](https://swr.vercel.app/docs/with-nextjs) — HIGH confidence
- [SWR Prefetching](https://swr.vercel.app/docs/prefetching) — HIGH confidence
- [Prisma: Query Optimization Performance](https://www.prisma.io/docs/orm/prisma-client/queries/query-optimization-performance) — HIGH confidence
- [Prisma: Indexes Documentation](https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes) — HIGH confidence
- [Prisma Migrate Limitations (CONCURRENTLY)](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/limitations-and-known-issues) — HIGH confidence
- [next-safe-action docs](https://next-safe-action.dev/) — HIGH confidence
- [React Email (Resend-maintained)](https://react.email) — HIGH confidence
- [Node.js crypto.timingSafeEqual / timing-safe auth](https://www.arun.blog/timing-safe-auth-web-crypto/) — HIGH confidence
- [PostgreSQL CREATE INDEX documentation](https://www.postgresql.org/docs/current/sql-createindex.html) — HIGH confidence
- [Upstash ratelimit-js (fail behavior)](https://github.com/upstash/ratelimit-js) — HIGH confidence
- Direct codebase analysis (`src/app/actions/membros.ts`, `src/middleware.ts`, `src/lib/rate-limit.ts`, `prisma/schema.prisma`, `src/lib/resend.ts`) — HIGH confidence

---

*Synthesis completed: 2026-02-16*
