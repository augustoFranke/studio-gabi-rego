# Feature Landscape: Production Hardening & Performance

**Domain:** Next.js gym management app hardening (security, performance, quality)
**Researched:** 2026-02-16
**Milestone type:** Subsequent — existing app, no new user-facing features

---

## Table Stakes

Features the production app must have. Each item below represents an active risk or confirmed bug in the current codebase. Shipping without these means the app is insecure, broken, or unmaintainable in ways that are observable today.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Server action auth checks** | `toggleMembroStatus`, `deleteMembro`, `deactivateMembro` have zero auth verification. Any authenticated user (including members) can call them. Server actions must be treated as public API endpoints — they are reachable via POST from any client. | Low | Add `auth()` check + `session.user.role === 'ADMIN'` guard at the top of each action in `src/app/actions/membros.ts`. Pattern already exists in `withApiAuth()`. |
| **Rate limiter fail-closed** | Rate limiter currently fails **open** when Upstash Redis is unconfigured. In production, a misconfigured `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` silently removes all brute-force protection from auth endpoints with only a `console.error`. | Low | In `src/lib/rate-limit.ts` lines 37–42: return `{ success: false }` when Redis is unavailable in production (`NODE_ENV === 'production'`). Keeps development behavior (fail open) while hardening production. |
| **Timing-safe cron secret comparison** | Cron endpoints compare `CRON_SECRET` with `===` (string equality). Timing attacks on secret comparison are a known vulnerability class. `crypto.timingSafeEqual` is the standard mitigation and has been available in Node.js since v6. | Low | Replace `=== token` with `crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(token))` in both cron route handlers. Must handle different-length inputs (throw or reject before comparison). |
| **Unified password policy** | Registration requires ≥8 chars + uppercase + number. Member update schema (`membro.schema.ts`) only requires 6 chars. These code paths diverge, creating inconsistent security posture. Mismatch means an admin can set a password that fails self-registration rules. | Low | Extract a shared `passwordSchema` Zod refinement in `src/schemas/auth.schema.ts` and import it in both `membro.schema.ts` and the registration route. |
| **Fix revalidatePath targets** | `toggleMembroStatus` and `deleteMembro` call `revalidatePath('/membros')` — a route that does not exist. The real route is `/alunos`. This is a confirmed bug: status toggle and delete don't refresh the UI. | Low | Change three calls in `src/app/actions/membros.ts` (lines 15, 39, 54) to `revalidatePath('/alunos')`. Trivial fix with outsized UX impact. |
| **Remove unused dependencies** | `pdf-lib`, `dompurify`, `isomorphic-dompurify` are listed as dependencies but not imported anywhere in `src/`. They inflate the dependency tree and the production bundle. `pdf-lib` is particularly large (~200 KB gzipped). | Low | Remove from `package.json`. Verify with `grep -r "pdf-lib\|dompurify\|isomorphic-dompurify" src/` before removing. Run existing tests to confirm no regression. |
| **Add composite database indexes** | The schema has zero explicit `@@index` declarations beyond Prisma defaults (PKs, unique constraints, FKs). Queries filtering by `status`, `dataVencimento`, and date ranges scan full tables. With a growing member list this degrades all financial and scheduling queries. | Medium | Add to `prisma/schema.prisma`: `@@index([status, dataVencimento])` on `Pagamento`, `@@index([status])` on `Membro`, `@@index([data])` on `Agendamento`. Generate migration. Run `EXPLAIN ANALYZE` on Supabase to confirm improvement. |
| **Centralize anamnese field definition** | `ANAMNESE_FIELDS` is defined in two places: as a `Set` in `src/lib/anamnese.ts` and as a `const` array in `src/app/api/minha-anamnese/route.ts`. Divergence causes silent data loss when fields are added. | Low | Have `minha-anamnese/route.ts` import and use `sanitizeAnamnesePayload` from `src/lib/anamnese.ts`. Delete the duplicate `buildAnamneseData` function. |
| **Centralize placeholder email generation** | `temp_{timestamp}@placeholder.local` generation is duplicated across two API routes with slightly different patterns. If the pattern drifts, `normalizeEmail()` silently fails to filter placeholders. | Low | Extract `generatePlaceholderEmail()` into `src/lib/email.ts`. Use it from both `src/app/api/membros/route.ts` and `src/app/api/membros/[id]/route.ts`. |
| **Tests for middleware route protection** | `src/middleware.ts` has zero test coverage. A typo in `ADMIN_ROUTES`, `MEMBER_ROUTES`, or `PUBLIC_ROUTES` arrays can silently expose admin routes to members or public. Authorization bypass via middleware misconfiguration is the highest-impact single-character mistake in the codebase. | Medium | Write Vitest unit tests that mock NextRequest and verify: (1) admin routes reject member tokens, (2) member routes reject unauthenticated requests, (3) public routes pass without auth. Mock `getToken` from `next-auth/jwt`. |
| **Tests for scheduler core logic** | `src/lib/scheduler.ts` runs automated billing reminders, birthday emails, and overdue payment updates. Only the thin HTTP route handlers are tested — the scheduler logic itself has no coverage. A deduplication bug would send duplicate notifications to all members silently. | Medium | Extract `processarAniversarios`, `processarCobrancas`, and overdue-update logic into testable pure functions. Write Vitest tests covering: (1) deduplication (no double-send in same window), (2) correct member filtering, (3) status transition correctness. |

---

## Differentiators

These improvements raise quality significantly but the app functions (without security holes) without them. Each has meaningful payoff but is not an active production risk.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **SWR caching on financeiro page** | The 1,612-line financeiro page fires separate `fetch()` calls on every mount and tab switch with no deduplication. `swr` is already a declared dependency — using it with shared keys eliminates redundant network calls and improves perceived performance. The page also needs component decomposition first (see below). | High | Depends on component split below. Convert `planos`, `pagamentos`, `membros`, and `stats` fetches to `useSWR` hooks. Use consistent SWR keys so multiple components sharing the same data don't re-fetch. |
| **Split financeiro page component** | At 1,612 lines, `src/app/(admin)/financeiro/page.tsx` is untestable and unmaintainable. Extracting `PlanoCard`, `PagamentoTable`, `PagamentoDialog`, and `FinanceiroStats` creates independently testable units and unblocks SWR migration. | High | This is the largest single-file refactor. Extract sub-components incrementally. Move inline Zod schemas to `src/schemas/financeiro.schema.ts`. No behavior changes — pure structural refactor. |
| **Split treinos generator page** | `src/app/(admin)/treinos/gerador/page.tsx` at 785 lines handles exercise list management, template selection, and member selection in a single component. No test coverage for the most complex user workflow in the admin panel. | Medium | Extract exercise list, template selector, and member selector into focused components. Enables unit testing of each part. |
| **Deduplicate email templates with react-email** | `src/lib/resend.ts` contains 7 full HTML email layouts (948 lines) with ~90% duplicated boilerplate. Changing the brand color requires updating 7 files identically. `react-email` (the official Resend-recommended library) enables component-based email templates with a shared layout. | Medium | Install `@react-email/components`. Create `EmailLayout` wrapper with shared header/footer. Each of the 7 templates becomes a focused component. Reduces resend.ts from 948 lines to ~150. HIGH confidence recommendation: Resend's own docs and examples use react-email natively. |
| **Birthday query at database level** | `processarAniversarios()` loads ALL active members into memory and filters in JavaScript for matching month/day. For a growing studio this adds latency and memory pressure on cron runs. | Low | Replace with `prisma.$queryRaw` using `EXTRACT(MONTH FROM data_nascimento) = $1 AND EXTRACT(DAY FROM data_nascimento) = $2`. Works with PostgreSQL (Supabase). Eliminates full-table scan in application memory. |
| **Pagination for unpaginated endpoints** | `/api/membros`, `/api/horarios`, and `/api/planos` return all records. As the member list grows, response payloads become large. `/api/pagamentos` already implements pagination — the pattern exists. | Low | Add `page` and `limit` query params to the three endpoints. Use `prisma.findMany({ skip, take })`. Default `limit=50` is safe and matches existing UX. |
| **Remove gender heuristic from anamnese route** | `determineSexo()` in `src/app/api/membros/[id]/anamnese/route.ts` guesses gender from first names using hardcoded lists. Defaults to "Masculino" — incorrect for a studio with predominantly female clientele. | Low | Delete the heuristic. Return `null` when `sexo` is not set. Surface a UI prompt to the admin to set it explicitly in the member profile. |
| **Middleware catch-all for unmatched routes** | Middleware falls through to `NextResponse.next()` for routes not in any array. Forgetting to add a new route to the right array exposes it as unprotected. A catch-all pattern (deny unknown authenticated routes) is safer by default. | Low | After the explicit route checks in `src/middleware.ts`, add a final else clause: authenticated requests to unrecognized routes redirect to login. Prevents future exposure by omission. |

---

## Anti-Features

Things to explicitly NOT do in this milestone. Each item has been considered and deliberately excluded.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **E2E tests with Playwright** | Playwright is installed but produces no test files. Writing E2E tests requires a running database, seeded data, and CI setup. This is a separate initiative with infrastructure dependencies. Attempting it in this milestone risks scope creep without payoff within the hardening window. | Defer to a dedicated testing milestone. The unit and API layer already covers 226 tests. Close the middleware and scheduler gaps first. |
| **Structured logging / Sentry integration** | Adding an error monitoring service (Sentry, LogRocket) is an infrastructure decision that affects billing, GDPR configuration, and PII handling. It does not fix existing bugs and adds scope. | Explicitly deferred in `PROJECT.md`. Flag as a future milestone. Current Vercel logs are sufficient for debugging this milestone's changes. |
| **Audit log for admin operations** | An audit log (who deleted which member, when) is a net-new feature with a new DB table, API surface, and UI. It does not fix any known bug or security vulnerability. | Explicitly out of scope per `PROJECT.md`. Consider as a post-hardening feature milestone. |
| **Migrate NextAuth v5 beta to stable** | No stable v5 is currently available. The current implementation is simple (Credentials provider + JWT). Migrating to a moving target introduces regression risk with no security gain. | Remain on pinned beta. Monitor for stable release. |
| **ORM-level query tracing / Prisma Optimize** | Prisma Optimize provides AI-powered query recommendations but requires a separate Prisma Data Platform account and adds external instrumentation to production. For a studio-scale app, targeted index additions based on the audit findings are sufficient. | Add the three specific indexes identified in the audit. Revisit Prisma Optimize only if query performance remains poor after indexes. |
| **Major component library migration** | shadcn/ui and Radix primitives are working well. Replacing or upgrading the component system is out of scope and carries visual regression risk. | Freeze UI library versions for this milestone. |
| **Next.js App Router data cache / fetch caching** | Next.js 16 has a more granular `fetch()` cache and `unstable_cache` API. Migrating server components to use these requires understanding the full cache invalidation story and is higher-risk than using SWR for client-side data. The app pattern (SWR already installed) suits the existing client-component model better. | Use SWR for client-side caching improvements. Server components that fetch directly from Prisma do not need a caching layer at this scale. |

---

## Feature Dependencies

```
Fix revalidatePath targets                   — standalone, no deps
Remove unused dependencies                   — standalone, no deps
Unified password policy                      — standalone, no deps
Timing-safe cron comparison                  — standalone, no deps
Rate limiter fail-closed                     — standalone, no deps
Server action auth checks                    — standalone, no deps
Centralize anamnese field definition         — standalone, no deps
Centralize placeholder email generation      — standalone, no deps

Add composite DB indexes                     — requires Prisma migration (generate + apply)
Birthday query at DB level                   — depends on DB index changes being in place first (or can run standalone)
Pagination for unpaginated endpoints         — standalone, but test coverage helps validate

Split financeiro page component              — prerequisite for SWR caching on financeiro
SWR caching on financeiro page               → requires: Split financeiro page component

Split treinos generator page                 — standalone structural refactor
Deduplicate email templates (react-email)    — standalone, but must maintain all 7 template outputs exactly

Tests for middleware                         — standalone; benefits from middleware catch-all hardening first
Tests for scheduler logic                    → requires: scheduler functions to be extractable (may need light refactor)
```

---

## MVP Recommendation

For a hardening milestone where the app is already live, apply in this order:

**Phase 1 — Security (all table stakes, must ship together or individually):**
1. Server action auth checks — exploitable now, trivial to fix
2. Rate limiter fail-closed — exploitable in production misconfiguration
3. Timing-safe cron comparison — defense in depth, low effort
4. Unified password policy — data integrity, low effort
5. Fix revalidatePath bug — confirmed broken behavior
6. Remove unused dependencies — safe, reduces attack surface and bundle size

**Phase 2 — Data Integrity and DB Performance:**
7. Centralize anamnese field definition — data loss risk on future changes
8. Centralize placeholder email generation — silent inconsistency risk
9. Add composite database indexes — direct query performance improvement
10. Birthday query at DB level — scales with member growth

**Phase 3 — Quality / Test Coverage:**
11. Tests for middleware — highest security testing priority
12. Tests for scheduler logic — highest business logic testing priority

**Phase 4 — Maintainability (differentiators):**
13. Split financeiro page component
14. SWR caching on financeiro (after split)
15. Split treinos generator page
16. Deduplicate email templates with react-email

**Defer from this milestone:**
- Pagination for unpaginated endpoints (not urgent at current scale)
- Remove gender heuristic (no active harm, low priority)
- Middleware catch-all (nice-to-have, not an active vulnerability)

---

## Sources

- [Next.js: How to Think About Security in Next.js](https://nextjs.org/blog/security-nextjs-server-components-actions) — server action authorization patterns (HIGH confidence)
- [Next.js: Data Security Guide](https://nextjs.org/docs/app/guides/data-security) — data access layer, server action auth patterns (HIGH confidence)
- [Next.js: Production Checklist](https://nextjs.org/docs/app/guides/production-checklist) — official production readiness guidance (HIGH confidence)
- [Prisma: Query Optimization Performance](https://www.prisma.io/docs/orm/prisma-client/queries/query-optimization-performance) — index strategies and query performance (HIGH confidence)
- [Prisma: Improving Query Performance with Indexes](https://www.prisma.io/blog/improving-query-performance-using-indexes-1-zuLNZwBkuL) — `@@index` usage patterns (HIGH confidence)
- [Node.js crypto.timingSafeEqual](https://developers.cloudflare.com/workers/examples/protect-against-timing-attacks/) — timing-safe comparison best practice (HIGH confidence)
- [SWR: Usage with Next.js](https://swr.vercel.app/docs/with-nextjs) — SWR in App Router, deduplication behavior (HIGH confidence)
- [React Email + Resend](https://resend.com/docs/send-with-nextjs) — component-based email templates, official Resend recommendation (HIGH confidence)
- [react-email GitHub](https://github.com/resend/react-email) — component-based email, Resend native integration (HIGH confidence)
- `.planning/codebase/CONCERNS.md` — codebase audit findings (source of truth for known issues)
- `.planning/codebase/ARCHITECTURE.md` — system structure and layer responsibilities
- `.planning/codebase/STACK.md` — confirmed dependency versions and status
