# Domain Pitfalls: Next.js App Hardening & Performance Optimization

**Domain:** Existing Next.js app (gym management) — hardening, refactoring, and performance
**Researched:** 2026-02-16
**Confidence:** HIGH (critical items verified against official Next.js docs and Prisma docs)

---

## Critical Pitfalls

Mistakes that cause security regressions, data loss, or rewrites.

---

### Pitfall 1: Server Actions Are Public API Endpoints — Not Guarded by Middleware

**What goes wrong:** Adding `auth()` checks to pages or API routes but leaving server actions in `src/app/actions/` unprotected. The middleware route guard only protects page navigation; it does NOT protect server action invocations. Any authenticated user (including members) can call `toggleMembroStatus`, `deleteMembro`, or `deactivateMembro` by POSTing to the action's internal endpoint.

**Why it happens:** Developers assume that since the UI only shows action buttons to admins, the server action itself is safe. Server actions are exported functions exposed as POST endpoints — they are callable by any client with a valid session, regardless of role.

**This project's specific risk:** `src/app/actions/membros.ts` — all three exported functions (`toggleMembroStatus`, `deleteMembro`, `deactivateMembro`) currently have zero auth checks. A member could delete any other member by invoking the action directly.

**Consequences:** Authorization bypass. A MEMBRO-role user can perform ADMIN-only mutations.

**Prevention:**
- Add `auth()` at the top of every server action, check `session.user.role === 'ADMIN'`
- Return `{ success: false, error: 'Não autorizado' }` on role mismatch — do not throw (throwing surfaces error hashes to the client in production)
- Pattern to follow (matches existing `withApiAuth` approach):
  ```typescript
  'use server'
  import { auth } from '@/lib/auth'

  export async function toggleMembroStatus(id: string, currentStatus: string) {
    const session = await auth()
    if (!session || session.user.role !== 'ADMIN') {
      return { success: false, error: 'Não autorizado' }
    }
    // ... rest of action
  }
  ```
- TypeScript types for arguments are erased at runtime — always validate argument types inside the action (e.g., check `typeof id === 'string'` or use Zod)

**Detection:** Audit every file with `'use server'` directive. Any exported function without an `auth()` call at the top is a vulnerability.

**Phase:** Security hardening phase (first phase, before any refactoring).

---

### Pitfall 2: Prisma Migrate Deploy Wraps Multiple Index Statements in a Transaction — Breaking CONCURRENTLY

**What goes wrong:** Adding multiple `@@index` declarations to `schema.prisma` in one migration causes Prisma to wrap all generated `CREATE INDEX` statements in a single SQL transaction. PostgreSQL forbids `CREATE INDEX CONCURRENTLY` inside a transaction block. This either causes the migration to fail or falls back to a locking `CREATE INDEX` that blocks writes on the table for the duration of indexing.

**Why it happens:** `prisma migrate deploy` uses transaction wrapping for multi-statement migrations by default. Prisma only skips the transaction wrapper when a migration file contains exactly one statement.

**This project's specific risk:** Adding `@@index([status, dataVencimento])` on `Pagamento`, `@@index([data])` on `Agendamento`, and `@@index([status])` on `Membro` in a single migration file will generate 3+ `CREATE INDEX` statements wrapped in a transaction. The `CONCURRENTLY` keyword cannot be used. On a live Supabase production database, standard `CREATE INDEX` acquires a `ShareLock` that blocks all writes to the table until the index build completes. For a small studio this is seconds, not minutes — acceptable risk — but the approach should be explicit.

**Consequences:** Migration failure if `CONCURRENTLY` is used, or a brief write-lock on production tables during index build.

**Prevention:**
- Accept the brief write lock for this project's scale (few hundred members) — it is safe
- One migration file per index if you need `CONCURRENTLY` (work around Prisma's transaction wrapping by creating separate migration files, one statement each)
- Alternatively: use Supabase's SQL editor to create indexes with `CONCURRENTLY` before running `prisma migrate deploy`, then mark the migration as applied with `prisma migrate resolve --applied`
- Do NOT add all indexes in a single migration and deploy during active hours — schedule during low-traffic window

**Detection warning signs:** Migration log shows `ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction block`

**Phase:** Performance optimization phase (DB indexes). Run migrations during off-hours.

---

### Pitfall 3: Converting Client Components to RSC Breaks Existing Vitest Tests That Mock Next.js Internals

**What goes wrong:** Converting a page from `'use client'` to a React Server Component (RSC) causes its Vitest unit tests to fail because server-only APIs (`cookies()`, `headers()`, `auth()`) cannot be imported in the Vitest `node` environment without mocking Next.js internals. Existing tests that mock `withApiAuth` or `auth()` at the module level may silently stop applying when the import chain changes.

**Why it happens:** Vitest resolves imports using its own module resolution — it does not run inside Next.js's build system. Server-only subpackages like `next/headers` and `next/cache` can throw `Error: ... is not available in this environment` when imported in Vitest without proper mocks. The existing test setup already mocks `next/cache` for `revalidatePath`, but RSC-converted pages that call `auth()` directly need `src/lib/auth` mocked too.

**This project's specific risk:** `src/__tests__/` already has patterns for mocking `withApiAuth` for API routes. If the financeiro page is converted to RSC and calls `auth()` directly (instead of going through `withApiAuth`), the existing server action test in `src/__tests__/actions/membros.test.ts` may stop exercising the real auth check path — it would exercise only the new check, which may not be mocked.

**Consequences:** Tests pass green while the security check is actually untested or not running. 226-test suite gives false confidence.

**Prevention:**
- Before converting any component to RSC, run `npm run test:run` to establish a green baseline
- After conversion, run tests again immediately — do not batch RSC conversions
- Mock `src/lib/auth` in Vitest for any test that now directly imports a server component calling `auth()`:
  ```typescript
  vi.mock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }))
  ```
- Keep `next/cache` mock in place — `revalidatePath` will still throw without it in Vitest

**Detection:** `Error: Invariant: Method expects to have requestAsyncStorage` or `Error: Static generation store missing` in test output after RSC conversion.

**Phase:** RSC conversion phase. Run full test suite after every individual conversion, not at end of phase.

---

### Pitfall 4: SWR Cache Keys Out of Sync with Mutation — Stale UI After Server Action

**What goes wrong:** Adding SWR to the financeiro page for data fetching but then calling server actions for mutations (delete payment, update status) causes the SWR cache to show stale data after the mutation succeeds. SWR caches by key; a server action that calls `revalidatePath` only clears the Next.js data cache (server-side router cache) — it does NOT invalidate client-side SWR caches.

**Why it happens:** Two separate cache systems: Next.js server-side router cache (cleared by `revalidatePath`) and SWR's client-side cache (cleared by `mutate(key)`). Developers often forget that server-side revalidation does not automatically flush the SWR cache in the browser.

**This project's specific risk:** The financeiro page currently fetches planos, pagamentos, and stats via separate `fetch()` calls on mount. The plan is to add SWR. If the existing delete/update logic (via API routes) also calls `revalidatePath`, the browser SWR cache still shows the old data until the user navigates away or manually triggers revalidation.

**Consequences:** User deletes a payment, the UI still shows it. User marks payment as PAGO, the stats total doesn't update. Confusing and trust-eroding for the studio admin.

**Prevention:**
- After every mutation, call `mutate(key)` from SWR to force revalidation of the affected key:
  ```typescript
  const { mutate } = useSWR('/api/pagamentos', fetcher)

  async function handleDelete(id: string) {
    await fetch(`/api/pagamentos/${id}`, { method: 'DELETE' })
    mutate() // re-fetch the list
  }
  ```
- Use SWR's global `mutate` for cross-key invalidation (e.g., after a payment update, also invalidate `/api/financeiro/stats`)
- Do NOT rely solely on `revalidatePath` in API route handlers for client-side cache consistency

**Detection:** After a mutation (delete/update), the list still shows the old data. Manual browser refresh shows the correct state.

**Phase:** Performance/SWR phase. Define SWR key naming conventions at phase start to ensure consistent `mutate()` calls.

---

## Moderate Pitfalls

---

### Pitfall 5: Splitting the 1612-Line Financeiro Component Breaks React Hook Rules

**What goes wrong:** Extracting sub-components from the financeiro page without understanding which hooks own shared state causes `Invalid hook call` errors or state synchronization bugs. The existing component manages pagamentos, planos, stats, dialogs, and pagination all in one place — state is shared via local variables, not props or context.

**Why it happens:** When you pull a sub-component (`PagamentoTable`) out of a parent, any hooks that were called at the top level of the original component must stay at the same level or be moved into the sub-component. Moving a `useState` into a sub-component while the parent still reads that state causes either prop drilling or incorrect lifting.

**This project's specific risk:** The financeiro page has inline dialog open/close state, pagination state, filter state, and currently-editing-item state all defined at the same level. Extracting `PagamentoDialog` without lifting the dialog state causes the dialog to be uncontrolled.

**Prevention:**
- Map all shared state before extracting any sub-component — draw a dependency diagram
- Extract custom hooks first (`usePagamentos`, `usePlanos`) before extracting UI components
- Move inline Zod schemas to `src/schemas/` before extraction (schemas defined inside a component body re-create on every render)
- Test after each extraction: run `npm run test:run` — the existing tests won't cover the UI, but TypeScript compilation catches hook-rule violations
- Use `'use client'` only on the leaf components that need interactivity; keep the page shell as RSC if possible

**Detection:** TypeScript/ESLint error `React Hook "useState" cannot be called inside a callback` or runtime `Invalid hook call` after extraction.

**Phase:** Refactoring phase (component splitting).

---

### Pitfall 6: `revalidatePath` Uses the Wrong Route Slug — Cache Never Clears

**What goes wrong:** Calling `revalidatePath('/membros')` when the actual route is `/alunos` silently does nothing — no error is thrown, the function completes, but the Next.js route cache for `/alunos` is never invalidated. This is already present in the codebase for `toggleMembroStatus` and `deleteMembro`.

**Why it happens:** Next.js does not validate that the path exists. `revalidatePath` accepts any string and silently ignores non-existent paths. Developers rename a route and forget to update the corresponding `revalidatePath` calls.

**This project's specific risk:** `src/app/actions/membros.ts` lines 15 and 39 use `'/membros'` but the page lives at `/alunos`. After status toggle or delete, the list page does not update without a manual refresh.

**Prevention:**
- Define route path constants in a shared file (e.g., `src/lib/routes.ts`) and import them everywhere — `revalidatePath` and `<Link href>` both use the constant
- After adding auth checks to server actions (Pitfall 1 fix), also fix the paths in the same commit
- Search for all `revalidatePath` calls before the refactoring phase: `grep -r "revalidatePath" src/`

**Detection:** After a mutation, the page shows stale data. Manual refresh shows updated state. No errors in logs.

**Phase:** Bug fix phase (first phase). Fix alongside the auth checks.

---

### Pitfall 7: Removing Unused Dependencies Breaks Imports Not Found by Static Analysis

**What goes wrong:** Removing `dompurify`, `isomorphic-dompurify`, and `pdf-lib` from `package.json` and not checking for dynamic imports, utility scripts, or test fixtures that reference them. Static analysis (`import` statements) is not sufficient — these packages may be used in `utility/` scripts or referenced in `pdf-lib`-based test code.

**Why it happens:** The test file `src/__tests__/pdf/generation.test.ts` uses `import { PDFDocument } from 'pdf-lib'` to validate generated PDFs. Removing `pdf-lib` from dependencies will break this test even though `pdf-lib` is not used in production code.

**This project's specific risk:** `src/__tests__/pdf/generation.test.ts` (visible in TESTING.md) imports `pdf-lib` for the `PDFDocument.load()` call to validate the output buffer. The production code uses `pdfkit`, but the test uses `pdf-lib` as a validation tool.

**Consequences:** Removing `pdf-lib` from `dependencies` breaks the PDF generation test suite. All PDF tests fail. Pre-commit hook catches this before push, but it creates confusion about whether pdf generation is broken.

**Prevention:**
- Before removing any package, run: `grep -r "package-name" src/ utility/ scripts/`
- Move `pdf-lib` to `devDependencies` (not removed) since it is only used in tests
- Remove `dompurify` and `isomorphic-dompurify` safely — they have no imports in `src/` or tests
- Verify with `npm run build` and `npm run test:run` after every dependency removal

**Detection:** `Cannot find module 'pdf-lib'` in test output after removal.

**Phase:** Bundle optimization phase. Remove one package at a time with test run between each.

---

### Pitfall 8: Rate Limiter "Fails Open" Is Not Just a Log Warning — It Is a Silent Misconfiguration Risk

**What goes wrong:** The current `src/lib/rate-limit.ts` logs `console.error("CRITICAL: ...")` but returns `{ success: true }` when Redis is not configured — even in production. During any Vercel deployment where the Upstash env vars are temporarily missing or typo'd, the rate limiter silently stops working. The `console.error` is visible in Vercel logs but does not trigger alerts.

**Why it happens:** The current design prioritizes developer experience (no Redis in dev) over production safety. Failing closed would break development. But the same `null` check applies in production.

**This project's specific risk:** If `UPSTASH_REDIS_REST_URL` is ever missing from a Vercel deployment (e.g., after rotating credentials), auth endpoints (`/api/auth/cadastro`, `/api/auth/enviar-reset-senha`) lose rate limiting silently.

**Prevention:**
- For the hardening phase: add a startup check in `src/instrumentation.ts` that logs a prominent warning if rate limiter is unconfigured when `NODE_ENV === 'production'`
- Consider adding an `/api/health` check that returns `rateLimit: false` when unconfigured, enabling external uptime monitoring to catch this
- The "fails open" behavior is acceptable for development — do not change it for dev environments

**Detection:** Check Vercel function logs for the `CRITICAL: Rate limiter not configured` message after each deployment.

**Phase:** Security hardening phase.

---

### Pitfall 9: Cron Secret Comparison Is Constant-Time But Vulnerable to Regex/Length Leaks If Moved to Middleware

**What goes wrong:** If cron route protection is moved from route-level bearer token checks into middleware (to "centralize" it), the middleware may use the wrong comparison method. The current implementation uses strict equality (`===`) which is NOT timing-safe and is vulnerable to timing attacks. The CONCERNS.md notes this as needing `crypto.timingSafeEqual`.

**Why it happens:** String equality in JavaScript (`===`) terminates early on the first differing character, leaking timing information about how many characters match. For a secret comparison, this enables brute-force timing attacks.

**This project's specific risk:** Cron endpoints trigger bulk email and WhatsApp sends. If an attacker can enumerate the secret byte-by-byte via timing, they can trigger arbitrary mass notifications.

**Prevention:**
- Replace `authHeader === \`Bearer ${CRON_SECRET}\`` with:
  ```typescript
  import { timingSafeEqual } from 'crypto'

  const provided = Buffer.from(authHeader ?? '')
  const expected = Buffer.from(`Bearer ${CRON_SECRET}`)

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  ```
- Keep cron protection in the route handler, not middleware — moving it to middleware requires care with the `PUBLIC_ROUTES` array (cron routes are currently in PUBLIC_ROUTES to bypass session auth, then checked inside the handler)

**Detection:** Code review. Look for any `===` comparison against a secret/token string.

**Phase:** Security hardening phase.

---

### Pitfall 10: Password Policy Divergence Between Registration and Admin Update

**What goes wrong:** Fixing the server action auth gaps without also unifying the Zod password schemas leaves an inconsistency: the registration endpoint requires 8+ characters with uppercase and a number, while the `membro.schema.ts` update schema only requires 6 characters. An admin can set a 6-character all-lowercase password via the update flow that would be rejected by the registration flow.

**Why it happens:** Schemas were written independently for each flow. Without a shared `passwordSchema`, they drift.

**This project's specific risk:** `src/schemas/membro.schema.ts` line 52 has weaker validation than `src/app/api/auth/cadastro/route.ts` lines 30-49.

**Prevention:**
- Extract a shared Zod schema: `src/schemas/shared.schema.ts` with `export const passwordSchema = z.string().min(8).regex(...)`
- Import and reuse it in both `cadastro/route.ts` and `membro.schema.ts`
- Update existing tests in `src/__tests__/schemas/membro.schema.test.ts` to reflect the stricter validation — do this in the same commit

**Detection:** Compare password validation rules across all auth-related schemas. Any divergence is the bug.

**Phase:** Security hardening phase. Fix alongside the server action auth gaps.

---

## Minor Pitfalls

---

### Pitfall 11: Adding `@@index` to Prisma Schema Without Understanding Existing Implicit Indexes

**What goes wrong:** Adding `@@index([membroId])` to `Pagamento` when `membroId` is already a foreign key — Prisma (and PostgreSQL) auto-creates an index for foreign keys via the `@relation` directive. Adding a redundant explicit index wastes storage and slows writes without benefiting queries.

**Prevention:**
- Before adding any index, check what indexes already exist: connect to Supabase and run `\d pagamentos` (or query `pg_indexes`)
- `@unique` and foreign key fields in Prisma already have indexes
- Target only composite indexes and non-FK filter columns: `@@index([status, dataVencimento])` on `Pagamento`, `@@index([data])` on `Agendamento`, `@@index([status])` on `Membro`

**Phase:** Performance optimization phase.

---

### Pitfall 12: Deduplicating Email Templates With a Layout Function Breaks Resend HTML Compatibility

**What goes wrong:** Extracting the shared HTML boilerplate in `src/lib/resend.ts` into a layout function and passing content as string interpolation risks breaking email rendering in Outlook and Gmail if the resulting HTML changes structure. Email clients are notoriously intolerant of template changes.

**Prevention:**
- Test all 7 email types (birthday, payment reminder, etc.) with a real send to Gmail and Outlook after refactoring
- Use `src/utility/preview-emails.ts` (already in the project) to visually verify all templates before deploying
- Keep the same outer table structure — only extract it, do not redesign it
- Consider `react-email` only if the team is comfortable with the added dependency; otherwise a simple `wrapEmail(content: string): string` function is safer

**Detection:** Send a test email after template refactoring. Check Gmail, Apple Mail, and Outlook rendering.

**Phase:** Refactoring phase (email deduplication).

---

### Pitfall 13: Middleware Route Array Omission Exposes New Routes

**What goes wrong:** Adding a new admin page (even during refactoring, e.g., a standalone `PagamentoDialog` page or a new route group) without updating `ADMIN_ROUTES` in `src/middleware.ts` leaves the route in the "falls through to `NextResponse.next()`" path — accessible to any user without authentication.

**Why it happens:** The middleware uses explicit allow-lists. The fail-safe is `NextResponse.next()`, not `NextResponse.redirect('/login')`. Adding routes during refactoring is easy to forget.

**This project's specific risk:** During component splitting, if any sub-page is created under a new path not in `ADMIN_ROUTES`, it will be publicly accessible until caught in review.

**Prevention:**
- No new routes are expected in this hardening milestone (scope is fix/optimize existing) — but document this as a rule: any new route must be added to the appropriate array before merging
- Consider adding a middleware test that explicitly asserts all known admin routes return 401/redirect for MEMBRO tokens

**Detection:** Access the route in an incognito window or with a MEMBRO session after adding it.

**Phase:** Middleware testing phase.

---

### Pitfall 14: Birthday Query Fix With `$queryRaw` Bypasses Prisma Type Safety

**What goes wrong:** Converting `processarAniversarios()` from an in-memory filter to a `prisma.$queryRaw` with `EXTRACT(MONTH FROM data_nascimento)` returns untyped `unknown[]` — the result loses Prisma's type inference. Attempting to access `result.id` or `result.nome` causes TypeScript errors or runtime `undefined`.

**Prevention:**
- Define a typed result type and cast with `as`:
  ```typescript
  type MembroAniversario = { id: string; nome: string; email: string }
  const membros = await prisma.$queryRaw<MembroAniversario[]>`
    SELECT m.id, u.nome, u.email
    FROM membros m
    JOIN usuarios u ON m.usuario_id = u.id
    WHERE EXTRACT(MONTH FROM m.data_nascimento) = ${month}
      AND EXTRACT(DAY FROM m.data_nascimento) = ${day}
      AND m.status = 'ATIVO'
  `
  ```
- Use tagged template literals with `$queryRaw` — never use `$queryRawUnsafe` with string interpolation
- Write a Vitest test for this function with a mocked `prisma.$queryRaw`

**Phase:** Performance optimization phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Server action auth fixes | Pitfall 1: Missing auth check; Pitfall 9: Wrong comparison method | Add `auth()` check + `timingSafeEqual`; fix `revalidatePath` in same commit |
| Rate limiter hardening | Pitfall 8: Silent misconfiguration in production | Add `/api/health` check for rate limiter status |
| Password policy fix | Pitfall 10: Updating schema breaks existing membro tests | Update tests in same commit as schema change |
| Component splitting (financeiro) | Pitfall 5: Hook rule violations; Pitfall 6: Wrong revalidatePath | Map state dependencies before splitting; run tests after each extraction |
| RSC conversion | Pitfall 3: Tests break on RSC conversion | Run `test:run` after each individual conversion; add `auth()` mocks |
| SWR adoption | Pitfall 4: Stale cache after mutations | Pair every mutation with `mutate(key)`; define SWR key constants |
| DB indexes | Pitfall 2: CONCURRENTLY in transaction; Pitfall 11: Redundant indexes | Inspect existing indexes first; use separate migration files or direct SQL |
| Dependency removal | Pitfall 7: `pdf-lib` used in tests | Move to `devDependencies`; grep before remove; test after each removal |
| Email deduplication | Pitfall 12: HTML layout change breaks email clients | Visual test all 7 templates via `preview-emails.ts` before deploy |
| Middleware tests | Pitfall 13: New routes bypass auth | Assert all admin routes in middleware test; no new routes in this milestone |
| Birthday query fix | Pitfall 14: `$queryRaw` loses type safety | Define explicit result type; use tagged template literal |

---

## Sources

- [How to Think About Security in Next.js (Official Next.js Blog)](https://nextjs.org/blog/security-nextjs-server-components-actions) — HIGH confidence
- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication) — HIGH confidence
- [Prisma Indexes Documentation](https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes) — HIGH confidence
- [Prisma Limitations and Known Issues (CONCURRENTLY)](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/limitations-and-known-issues) — HIGH confidence
- [Support CREATE INDEX CONCURRENTLY — Prisma GitHub Issue #14456](https://github.com/prisma/prisma/issues/14456) — HIGH confidence
- [PostgreSQL CREATE INDEX documentation](https://www.postgresql.org/docs/current/sql-createindex.html) — HIGH confidence
- [SWR Usage with Next.js (Official Vercel docs)](https://swr.vercel.app/docs/with-nextjs) — HIGH confidence
- [Vitest + Next.js Server Action revalidateTag issue](https://github.com/vercel/next.js/discussions/61151) — MEDIUM confidence (GitHub discussion)
- [Secure Next.js Server Actions — makerkit.dev](https://makerkit.dev/blog/tutorials/secure-nextjs-server-actions) — MEDIUM confidence (verified against official Next.js blog)
- Direct codebase analysis of `src/app/actions/membros.ts`, `src/middleware.ts`, `src/lib/rate-limit.ts`, `src/lib/auth.ts`, `prisma/schema.prisma` — HIGH confidence

---

*Pitfalls research: 2026-02-16*
