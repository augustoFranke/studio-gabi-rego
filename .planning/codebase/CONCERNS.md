# Codebase Concerns

**Analysis Date:** 2026-02-16

## Tech Debt

**Massive financeiro page component (1,612 lines):**
- Issue: `src/app/(admin)/financeiro/page.tsx` is a single client component handling plans CRUD, payments CRUD, stats display, dialogs, pagination, filtering, and sorting. It contains inline schemas, local type definitions, and all UI in one file.
- Files: `src/app/(admin)/financeiro/page.tsx`
- Impact: Extremely difficult to maintain, test, or modify. Any change risks regressions across unrelated financial features. No unit tests exist for this page logic.
- Fix approach: Extract into sub-components (`PlanoCard`, `PagamentoTable`, `PagamentoDialog`, `FinanceiroStats`), move inline schemas to `src/schemas/`, and extract data fetching into custom hooks.

**Duplicated email template HTML (948 lines):**
- Issue: `src/lib/resend.ts` contains 7 full HTML email templates as inline template literals. Each template duplicates the entire HTML boilerplate (header, footer, styling, layout tables). The file is nearly 950 lines, with ~90% being duplicated HTML structure.
- Files: `src/lib/resend.ts`
- Impact: Updating the brand design (colors, logo URL, footer text) requires changing 7 templates identically. High risk of inconsistency.
- Fix approach: Extract a shared email layout function that wraps content, or use a templating library (e.g., react-email). Keep `emailTemplates` as the export interface but reduce internal duplication.

**Duplicated ANAMNESE_FIELDS definition:**
- Issue: The list of anamnese fields is defined in two places: as a `Set` in `src/lib/anamnese.ts` and as a `const` array in `src/app/api/minha-anamnese/route.ts`. Both must be kept in sync manually.
- Files: `src/lib/anamnese.ts`, `src/app/api/minha-anamnese/route.ts`
- Impact: Adding/removing an anamnese field requires updating two locations. Divergence causes silent data loss.
- Fix approach: Use the canonical `ANAMNESE_FIELDS` set from `src/lib/anamnese.ts` everywhere. The `minha-anamnese` route should import and use `sanitizeAnamnesePayload` from `src/lib/anamnese.ts` instead of defining its own `buildAnamneseData`.

**Placeholder email workaround for admin-created members:**
- Issue: When an admin creates a member without an email, the system generates `temp_{timestamp}@placeholder.local` as a fake email to satisfy the unique constraint. This is repeated in two API routes with slightly different patterns.
- Files: `src/app/api/membros/route.ts` (line 156), `src/app/api/membros/[id]/route.ts` (line 62), `src/lib/email.ts`
- Impact: Placeholder emails pollute the `usuarios` table. The `email.ts` helper knows about the domain but the generation logic is duplicated. If the pattern drifts, `normalizeEmail()` may not correctly filter placeholders.
- Fix approach: Centralize placeholder email generation in `src/lib/email.ts` as a `generatePlaceholderEmail()` function, and use it from both API routes. Consider making `email` nullable on the `Usuario` model instead.

**Gender heuristic in anamnese route:**
- Issue: `src/app/api/membros/[id]/anamnese/route.ts` contains a `determineSexo()` function that guesses gender from first names using hardcoded lists and suffix heuristics. This is a fallback for when `sexo` is not set in the database.
- Files: `src/app/api/membros/[id]/anamnese/route.ts` (lines 99-135)
- Impact: Inaccurate for non-Portuguese names, gender-neutral names, or non-binary individuals. Returns "Masculino" as default, which is incorrect for a fitness studio with predominantly female clientele.
- Fix approach: Remove the heuristic. Return `null` when `sexo` is not set, and prompt the admin to set it explicitly in the member profile.

**Inconsistent revalidatePath in server actions:**
- Issue: `src/app/actions/membros.ts` uses `/membros` for `toggleMembroStatus` and `deleteMembro`, but `/alunos` for `deactivateMembro`. The actual route is `/alunos`, so the first two revalidations target a non-existent path.
- Files: `src/app/actions/membros.ts` (lines 15, 39, 54)
- Impact: Status toggle and delete operations may not refresh the UI correctly because they revalidate `/membros` instead of `/alunos`.
- Fix approach: Change all three to `revalidatePath('/alunos')`.

**Large treinos generator page (785 lines):**
- Issue: `src/app/(admin)/treinos/gerador/page.tsx` is a complex client-side form handling exercise management, template loading, member selection, and form submission in a single component.
- Files: `src/app/(admin)/treinos/gerador/page.tsx`
- Impact: Difficult to maintain and no test coverage for this critical workflow.
- Fix approach: Extract exercise list management, template selection, and member selection into separate components or hooks.

## Known Bugs

**Incorrect revalidation path for member status toggle:**
- Symptoms: After toggling a member's status (active/inactive) or deleting a member, the `/alunos` list page may not update because `revalidatePath('/membros')` targets a non-existent route.
- Files: `src/app/actions/membros.ts` (lines 15, 39)
- Trigger: Toggle status or delete any member from the member detail page.
- Workaround: Manual browser refresh shows updated data.

## Security Considerations

**next-auth v5 beta dependency:**
- Risk: The app uses `next-auth@^5.0.0-beta.30`, which is a pre-release version. Beta releases may contain security vulnerabilities that are not tracked in advisory databases, and breaking changes can occur between versions.
- Files: `package.json` (line 70), `src/lib/auth.ts`, `src/middleware.ts`
- Current mitigation: The auth implementation is straightforward (credentials provider + JWT).
- Recommendations: Monitor for stable v5 release and upgrade promptly. Pin to a specific beta version rather than using `^` range to avoid unexpected upgrades.

**Rate limiter fails open in production:**
- Risk: When Upstash Redis is not configured (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` missing), the rate limiter logs a warning but allows all requests through. This is intentional for development but dangerous if production misconfigures Redis.
- Files: `src/lib/rate-limit.ts` (lines 37-42)
- Current mitigation: A `console.error("CRITICAL: ...")` log is emitted.
- Recommendations: Consider failing closed in production (return `{ success: false }`) or add a health check that alerts when rate limiting is disabled.

**Server actions lack auth checks:**
- Risk: `src/app/actions/membros.ts` performs `toggleMembroStatus`, `deleteMembro`, and `deactivateMembro` without verifying the caller's session or role. Any authenticated user (including members) could invoke these server actions.
- Files: `src/app/actions/membros.ts`
- Current mitigation: The UI only shows these buttons to admins, but server actions are callable by any client.
- Recommendations: Add `auth()` check at the top of each server action and verify `session.user.role === 'ADMIN'`.

**Cron endpoints protected by shared secret only:**
- Risk: `src/app/api/cron/tarefas-email/route.ts` and `src/app/api/cron/cobrancas-whatsapp/route.ts` authenticate via a `CRON_SECRET` bearer token. If the secret is weak or leaked, anyone can trigger bulk email/WhatsApp sends.
- Files: `src/app/api/cron/tarefas-email/route.ts`, `src/app/api/cron/cobrancas-whatsapp/route.ts`
- Current mitigation: The cron routes are in the PUBLIC_ROUTES middleware allowlist, so they bypass session auth. Token comparison uses strict equality (no timing attack, but could use `crypto.timingSafeEqual`).
- Recommendations: Use `crypto.timingSafeEqual` for token comparison. Consider IP allowlisting for Vercel cron source IPs.

**Password policy inconsistency:**
- Risk: The registration endpoint (`src/app/api/auth/cadastro/route.ts`) requires 8 characters, uppercase, and a number. The member update schema (`src/schemas/membro.schema.ts`) only requires 6 characters. Admin-created members with no password get a random hash.
- Files: `src/app/api/auth/cadastro/route.ts` (lines 30-49), `src/schemas/membro.schema.ts` (line 52)
- Current mitigation: None.
- Recommendations: Unify password validation into a shared Zod schema used in both registration and admin update flows.

**DOMPurify imported but unused:**
- Risk: `dompurify` and `isomorphic-dompurify` are listed as dependencies but not imported anywhere in `src/`. This suggests either planned sanitization that was never implemented, or sanitization was removed but dependencies were not cleaned up.
- Files: `package.json` (lines 67-68)
- Current mitigation: The `src/lib/anamnese.ts` sanitizer and `src/lib/resend.ts` `escapeHtml` handle the current sanitization needs.
- Recommendations: Remove `dompurify` and `isomorphic-dompurify` from dependencies if not needed, or implement HTML sanitization where user content is rendered.

## Performance Bottlenecks

**Birthday notification fetches all active members:**
- Problem: `processarAniversarios()` in `src/lib/scheduler.ts` loads ALL active members into memory, then filters in JavaScript for matching birthday month/day.
- Files: `src/lib/scheduler.ts` (lines 256-269)
- Cause: PostgreSQL cannot natively extract month/day from a `DateTime` field in a Prisma `where` clause, so the filtering is done application-side.
- Improvement path: Use `prisma.$queryRaw` with `EXTRACT(MONTH FROM data_nascimento)` and `EXTRACT(DAY FROM data_nascimento)` to filter at the database level. For a small studio this is not critical, but it does not scale.

**No database indexes beyond Prisma defaults:**
- Problem: The schema relies entirely on Prisma's default indexes (primary keys, unique constraints, and foreign keys). Queries that filter by `status`, `dataVencimento`, or date ranges have no composite indexes.
- Files: `prisma/schema.prisma`
- Cause: No explicit `@@index` declarations in the schema.
- Improvement path: Add `@@index([status, dataVencimento])` on `Pagamento`, `@@index([data])` on `Agendamento`, and `@@index([status])` on `Membro`. Monitor query performance with Supabase dashboard.

**Client-side data fetching on financeiro page:**
- Problem: The 1,612-line financeiro page fetches planos, pagamentos, membros, and stats via separate `fetch()` calls on mount. Each tab switch or filter change triggers additional API calls.
- Files: `src/app/(admin)/financeiro/page.tsx`
- Cause: The page is a client component that manages all state locally instead of using server components or SWR for data.
- Improvement path: Use `useSWR` (already a dependency) for data fetching with caching and deduplication. Consider making the page a server component with client sub-components.

## Fragile Areas

**Scheduler notification deduplication:**
- Files: `src/lib/scheduler.ts`, `src/lib/jobs/cobranca-whatsapp.ts`
- Why fragile: The `processNotifications` helper checks for existing notifications using time-based ranges (e.g., "last 24 hours"). If the cron job timing shifts or runs more than once in a window, duplicate notifications can be sent. The `cobranca-whatsapp` job uses a different deduplication approach (exact date match) than the email scheduler (time range).
- Safe modification: Always test deduplication logic with overlapping cron runs. The `Notificacao.refKey` unique field exists but is only used by some jobs.
- Test coverage: `src/__tests__/api/cron-tarefas-email.test.ts` and `src/__tests__/api/cron-cobrancas-whatsapp.test.ts` exist but only test the route handlers, not the scheduler logic itself.

**Middleware route matching:**
- Files: `src/middleware.ts`
- Why fragile: The route protection is based on hardcoded string arrays (`ADMIN_ROUTES`, `MEMBER_ROUTES`, `PUBLIC_ROUTES`). Adding a new route requires updating the middleware; forgetting to do so exposes the route as unprotected (falls through to `NextResponse.next()`).
- Safe modification: When adding any new route group, always update the corresponding array in `src/middleware.ts`. Consider using a catch-all approach where unmatched authenticated routes redirect to login.
- Test coverage: No direct tests for middleware route matching logic.

## Scaling Limits

**Single-instance cron design:**
- Current capacity: Cron jobs are triggered by HTTP POST and run synchronously. The scheduler processes notifications sequentially (one member at a time).
- Limit: With hundreds of members, the cron job could time out on Vercel's serverless function limit (10-60 seconds depending on plan).
- Scaling path: Use `Promise.allSettled` for parallel notification sends, or use Upstash QStash for fan-out to individual member notifications.

**No pagination on several API endpoints:**
- Current capacity: `GET /api/membros`, `GET /api/horarios`, and `GET /api/planos` return all records.
- Limit: With hundreds of members or schedule slots, response payloads become large.
- Scaling path: Add pagination parameters (`page`, `limit`) similar to `GET /api/pagamentos` which already implements pagination.

## Dependencies at Risk

**next-auth v5 beta (^5.0.0-beta.30):**
- Risk: Pre-release software. API surface may change. Security patches may not follow standard advisory processes.
- Impact: Authentication is the foundation of the entire app. A breaking change in next-auth could lock users out.
- Migration plan: Stay on current beta pin, monitor for stable 5.x release, and upgrade when available. The auth implementation is simple enough to adapt.

**Dual PDF libraries (pdf-lib + pdfkit):**
- Risk: Both `pdf-lib` (^1.17.1) and `pdfkit` (^0.17.2) are listed as dependencies, but only `pdfkit` is imported in `src/lib/pdf.ts`. `pdf-lib` appears unused.
- Impact: Unnecessary bundle size and potential confusion about which library to use.
- Migration plan: Remove `pdf-lib` from `package.json` if it is not imported anywhere.

**Zod v4 (^4.3.5):**
- Risk: Zod v4 is relatively new. The project uses it for all request validation. If the project was migrated from v3, there may be subtle behavioral differences.
- Impact: Low risk -- Zod v4 is stable. But worth noting as a recent upgrade.
- Migration plan: None needed. Keep updated.

## Missing Critical Features

**No structured logging:**
- Problem: All logging uses `console.log/warn/error`. There is no structured logging, log levels, or log aggregation beyond what Vercel provides by default.
- Files: Throughout `src/app/api/`, `src/lib/scheduler.ts`, `src/lib/resend.ts`
- Blocks: Debugging production issues, audit trails for sensitive operations (member deletion, payment status changes).

**No error tracking / monitoring:**
- Problem: No Sentry, LogRocket, or similar error tracking service is integrated. Production errors are only visible in Vercel logs, which have limited retention and no alerting.
- Blocks: Proactive incident detection. Silent failures in cron jobs, email sends, or WhatsApp sends go unnoticed.

**No audit log for admin operations:**
- Problem: Admin actions like deleting a member, changing payment status, or modifying plans have no audit trail beyond `atualizadoEm` timestamps.
- Blocks: Accountability for data changes, debugging when data appears incorrect.

## Test Coverage Gaps

**No tests for client-side components or pages:**
- What's not tested: All `src/app/(admin)/` pages, `src/app/(aluno)/` pages, `src/app/(auth)/` pages, and `src/components/` are untested. The test suite covers API routes, schemas, services, and PDF generation only.
- Files: `src/app/(admin)/financeiro/page.tsx` (1,612 lines), `src/app/(admin)/treinos/gerador/page.tsx` (785 lines), all components in `src/components/`
- Risk: UI regressions go undetected. The most complex files (financeiro, treinos generator) have zero test coverage.
- Priority: Medium -- the API layer is well-tested, but critical user workflows lack any automated verification.

**No tests for scheduler logic:**
- What's not tested: `src/lib/scheduler.ts` contains core business logic for notification processing, billing reminders, and overdue payment updates. Only the thin cron route handlers are tested.
- Files: `src/lib/scheduler.ts`, `src/lib/jobs/cobranca-whatsapp.ts`
- Risk: Notification deduplication bugs, missed birthday emails, or incorrect overdue payment transitions would not be caught.
- Priority: High -- this is critical business logic that runs automatically without user oversight.

**No tests for middleware:**
- What's not tested: `src/middleware.ts` route protection logic. No tests verify that admin routes reject member tokens or that public routes are accessible without auth.
- Files: `src/middleware.ts`
- Risk: A typo in route arrays could expose admin functionality to all users.
- Priority: High -- authorization bypass is a security concern.

**No E2E tests:**
- What's not tested: Full user flows (registration, onboarding, scheduling, payments).
- Files: `playwright` is listed in devDependencies but no test files exist.
- Risk: Integration issues between client and server code go undetected.
- Priority: Low -- unit and API tests cover most logic, but E2E would catch flow-level regressions.

---

*Concerns audit: 2026-02-16*
