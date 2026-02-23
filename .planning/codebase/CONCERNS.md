# Codebase Concerns

**Analysis Date:** 2026-02-11

## Tech Debt

**Large monolithic page components:**
- Issue: Several frontend page components exceed 1000 lines, particularly `src/app/(admin)/financeiro/page.tsx` (1610 lines), `src/app/(admin)/treinos/gerador/page.tsx` (785 lines), and `src/app/(auth)/anamnese/page.tsx` (747 lines). These are difficult to maintain, test, and extend. Complex state management and business logic are tightly coupled with UI rendering.
- Files: `src/app/(admin)/financeiro/page.tsx`, `src/app/(admin)/treinos/gerador/page.tsx`, `src/app/(auth)/anamnese/page.tsx`, `src/app/(admin)/treinos/[id]/editar/page.tsx` (674 lines), `src/components/forms/MemberForm.tsx` (596 lines)
- Impact: Hard to isolate bugs, reduces code reusability, slow development velocity when making changes to any single feature
- Fix approach: Extract business logic into custom hooks, break components into smaller focused presentational components, move form validation and submission logic into separate modules

**Email HTML template bloat:**
- Issue: `src/lib/resend.ts` contains 948 lines of monolithic email template code with inline HTML strings. Each email template is a massive string literal making it difficult to modify styling, add new templates, or test variations.
- Files: `src/lib/resend.ts`
- Impact: Hard to maintain email templates, difficult to add new email types, code becomes unwieldy to review
- Fix approach: Migrate to a template library like React Email or move templates to separate files/templates directory with proper structure

**Direct environment variable access (47 instances):**
- Issue: Scattered `process.env.*` calls throughout codebase instead of centralized configuration. Found in middleware, API routes, components, and tests. Makes environment variable validation fragile and harder to ensure all required vars are set.
- Files: `src/middleware.ts`, `src/app/api/perfil/route.ts`, `src/app/api/auth/reenviar-verificacao/route.ts`, `src/app/api/auth/enviar-reset-senha/route.ts`, `src/app/api/auth/cadastro/route.ts`, `src/app/api/health/route.ts`, `src/app/api/anamnese-token/route.ts`, `src/app/api/cron/cobrancas-whatsapp/route.ts`, `src/app/api/cron/tarefas-email/route.ts`, `src/app/(auth)/completar-perfil/page.tsx`, `src/components/error-boundary.tsx`
- Impact: Missing environment variables won't be caught until runtime; difficult to track which variables are used where; no single source of truth for configuration
- Fix approach: Create centralized config module `src/lib/config.ts` that validates and exposes all env vars at startup, or use @t3-oss/env-nextjs for type-safe env vars

**HTML escaping and sanitization scattered:**
- Issue: Multiple sanitization approaches used throughout: custom HTML escaping in `src/lib/resend.ts` (lines 8-37), dompurify/isomorphic-dompurify imported but usage pattern inconsistent. Email building in resend.ts has custom regex-based sanitization that may miss edge cases.
- Files: `src/lib/resend.ts`, `src/lib/validators.ts`, potentially other places doing manual string manipulation
- Impact: Security vulnerability risk if escaping is inconsistent or incomplete; harder to audit sanitization across codebase
- Fix approach: Create centralized sanitization module with consistent API; use established library (dompurify) everywhere instead of custom regex

**Scheduler is hardcoded for production workarounds:**
- Issue: `src/lib/scheduler.ts` (379 lines) contains note about production considerations: "En produção, considerar usar: - Vercel Cron Jobs - Upstash QStash - node-cron (se self-hosted)". Currently appears to be in-memory/polling-based, which won't scale and won't survive server restarts.
- Files: `src/lib/scheduler.ts`
- Impact: Notifications/reminders/billing cron jobs will not run reliably in production; can miss billing cycles, class reminders, and automated tasks
- Fix approach: Implement proper job queue (Upstash, Bull, or Vercel Cron) instead of in-memory scheduling

## Performance Bottlenecks

**Unbounded queries without pagination in some endpoints:**
- Issue: `src/app/api/planos/route.ts`, `src/app/api/agendamentos/route.ts` (line 88), and `src/app/api/horarios/route.ts` use `findMany()` without pagination limits. Only `src/app/api/pagamentos/route.ts` implements proper pagination with skip/take. As data grows, these endpoints will fetch all records and cause N+1 query issues.
- Files: `src/app/api/planos/route.ts` (line 15), `src/app/api/agendamentos/route.ts` (line 88), `src/app/api/horarios/route.ts` (line 23), `src/app/api/membros/route.ts` (lines 37, 42)
- Impact: Slow response times as datasets grow; server memory pressure; poor user experience during peak usage
- Fix approach: Add pagination with limit/offset or cursor-based pagination to all GET endpoints

**Scheduler batch processing with hardcoded batch size:**
- Issue: `src/lib/scheduler.ts` (line 60) uses hardcoded `BATCH_SIZE = 5` for processing notifications. No adaptive batching based on API rate limits, no backpressure handling, and all batches processed sequentially in a loop.
- Files: `src/lib/scheduler.ts` (lines 60-80)
- Impact: External API rate limits could cause failures; inefficient use of async parallelism; slow notification delivery during high volume
- Fix approach: Make batch size configurable per integration; implement rate limit awareness; use proper work queue

**PDF generation without streaming:**
- Issue: `src/lib/pdf.ts` generates entire PDF in memory before returning. PDFKit documents accumulate in memory without streaming support.
- Files: `src/lib/pdf.ts`
- Impact: Large PDFs cause memory spikes; long-running requests for large training plans; poor performance under load
- Fix approach: Implement streaming response for PDF generation

**Page revalidation cache strategy needs tuning:**
- Issue: Various pages use hardcoded revalidation times: `{ revalidate: 60 }` for members list, `{ revalidate: 30 }` for dashboard, `{ revalidate: false }` on some SWR calls. No clear strategy based on data freshness requirements.
- Files: `src/app/(admin)/alunos/page.tsx` (line 70), `src/app/(admin)/dashboard/page.tsx` (line 176), multiple SWR hooks with `revalidateOnFocus: false`
- Impact: Stale data shown to users or unnecessary revalidation causing slow page loads; inconsistent user experience
- Fix approach: Document cache strategy based on data freshness requirements; use ISR patterns where appropriate

## Fragile Areas

**Complex agendamento (scheduling) logic with multiple related entities:**
- Issue: `src/app/api/agendamentos/[id]/route.ts` and `src/services/agendamento.service.ts` handle complex recurring appointment generation, validation, and cascading deletes. Scope parameter allows single or "future" deletions affecting multiple records. HorarioFixo validation adds more complexity.
- Files: `src/app/api/agendamentos/[id]/route.ts`, `src/services/agendamento.service.ts`, `src/lib/schedule.ts`
- Impact: Difficult to test; easy to introduce bugs affecting user's schedules; cascading deletes risk data loss
- Safe modification: Add comprehensive integration tests before changing scope handling logic; document business rules for recurring appointments; add transaction wrapping for cascading operations

**Anamnese (intake form) flow with token-based access:**
- Issue: `src/app/(auth)/anamnese/page.tsx` (747 lines) handles complex form with token validation, auto-save, and multiple sections. Token generation in `src/app/api/anamnese-token/route.ts` and validation scattered across multiple endpoints.
- Files: `src/app/(auth)/anamnese/page.tsx`, `src/app/api/anamnese-token/route.ts`, `src/app/api/minha-anamnese/route.ts`
- Impact: Token expiration not consistently enforced; test coverage likely incomplete; refactoring form structure is risky
- Safe modification: Extract form logic into separate module; add comprehensive token lifecycle tests; separate validation from business logic

**Manual date parsing without consistent timezone handling:**
- Issue: Multiple places use `parseLocalDate` helper from `src/lib/schedule.ts` to parse dates, but timezone handling is implicit and may not be consistent. Scheduler uses explicit timezone handling with new Date() arithmetic which is error-prone.
- Files: `src/lib/schedule.ts`, `src/app/api/agendamentos/route.ts`, `src/app/(aluno)/minha-agenda/page.tsx`
- Impact: Edge cases around midnight, DST transitions, or timezone mismatches could cause scheduling bugs; hard to debug timezone-related issues
- Safe modification: Establish explicit timezone handling strategy; consider using date-fns or day.js with timezone support; add tests for edge cases

**Financial pages with complex state and real-time updates:**
- Issue: `src/app/(admin)/financeiro/page.tsx` (1610 lines) has complex state management for payments, plans, members with inline CRUD operations. Multiple tabs with different data models and error states.
- Files: `src/app/(admin)/financeiro/page.tsx`
- Impact: High risk of state management bugs; difficult to test individual features; refactoring is dangerous
- Safe modification: Break into separate components per tab; extract form logic into custom hooks; add comprehensive tests for each operation before refactoring

## Test Coverage Gaps

**API routes lack comprehensive error case testing:**
- Issue: Found many API endpoints but `src/__tests__/api/` contains sparse coverage (only 247-line test file for agendamentos, some mock test files). No visible tests for payment flows, member creation edge cases, or cron job execution.
- Files: All `src/app/api/**/*.ts` routes
- Impact: Edge cases and error scenarios not validated; production bugs from missing validation; regressions go unnoticed
- Priority: High - financial/payment code especially needs coverage

**Frontend components (especially large pages) lack unit tests:**
- Issue: Large components like `src/app/(admin)/financeiro/page.tsx`, `src/app/(admin)/treinos/gerador/page.tsx` have no visible tests. Form components have no test coverage for validation, submission, or error states.
- Files: `src/app/(admin)/**/*.tsx`, `src/components/forms/**/*.tsx`
- Impact: UI bugs in payment flows, training plan generation, member management go undetected; refactoring is risky
- Priority: High - user-facing feature code needs tests

**Missing integration tests for authentication flows:**
- Issue: Auth routes exist (`src/app/api/auth/**/*.ts`) but integration tests for signup, password reset, email verification are not evident.
- Files: `src/app/api/auth/**/*.ts`
- Impact: Auth bugs affect entire application; edge cases like token expiration not verified
- Priority: High - security/core functionality

**Schedule/cron job execution never tested:**
- Issue: `src/lib/scheduler.ts` has complex notification processing but no tests to verify notifications are actually created and sent
- Files: `src/lib/scheduler.ts`
- Impact: Cron jobs may fail silently; users won't receive reminders/notifications without knowing
- Priority: High - user-facing functionality

## Security Considerations

**Cron endpoints rely on environment variable secret:**
- Issue: `src/app/api/cron/**/*.ts` routes use `process.env.CRON_SECRET` for authorization. No rate limiting on cron endpoints themselves. If secret is leaked or weak, unauthorized job triggering is possible.
- Files: `src/app/api/cron/cobrancas-whatsapp/route.ts` (line 15), `src/app/api/cron/tarefas-email/route.ts` (line 14)
- Current mitigation: Environment variable exists, but no docs on secret strength requirements
- Recommendations: Use Upstash/Vercel webhook signing instead of simple secret; add IP allowlist if using Vercel Cron; rotate secret regularly

**Email templates use HTML construction with potential XSS risk:**
- Issue: Email templates in `src/lib/resend.ts` use custom HTML escaping (lines 8-37) rather than template engine. If any unescaped user data enters templates, XSS is possible.
- Files: `src/lib/resend.ts` (emailTemplates functions)
- Current mitigation: Manual escaping functions implemented
- Recommendations: Use React Email or similar typed template library to prevent string-based XSS; add JSDoc examples showing safe usage; consider using template literals with explicit escaping helpers

**Sensitive data potentially exposed in console logs:**
- Issue: 20+ console.error/warn statements throughout app. Error responses sometimes logged without filtering sensitive fields (emails, phone numbers). Development mode error boundary shows full stack traces.
- Files: `src/app/(aluno)/minha-agenda/page.tsx`, `src/app/api/**/*.ts`, `src/components/error-boundary.tsx` (line 55)
- Current mitigation: NODE_ENV check in error-boundary
- Recommendations: Implement structured logging with field masking; never log full error objects; sanitize error messages before returning to client; use logging service (e.g., Sentry) for production

**CPF/sensitive data in URLs and logs:**
- Issue: Some routes accept CPF in search params or body. While validated, if logged or exposed in errors, sensitive ID data could leak.
- Files: `src/lib/validators.ts` (CPF validation), forms accepting CPF input
- Impact: Personal data leakage if errors/logs are exposed
- Recommendations: Ensure CPF never appears in logs; consider hashing for lookups instead of plaintext; add data retention policy for sensitive fields

**Database connection string handling:**
- Issue: `DATABASE_URL` and `DIRECT_URL` set via environment variables. If deployed to environment where .env files are accessible or env var dumps are logged, credentials could leak.
- Current mitigation: .env in .gitignore
- Recommendations: Ensure env vars only accessible to application code; use secrets manager in production (e.g., AWS Secrets Manager, Vercel Secrets); never log DATABASE_URL; rotate credentials on suspected exposure

## Scaling Limits

**In-memory scheduler won't scale beyond single instance:**
- Issue: `src/lib/scheduler.ts` processes notifications in-memory. On multiple server instances, duplicate notifications will be sent. No distributed coordination.
- Impact: Each instance runs same cron job → duplicate emails/WhatsApp messages; notification storms
- Scaling path: Migrate to Upstash QStash, Vercel Cron, or Bull with Redis for distributed job processing

**Agendamentos findMany without pagination limit:**
- Issue: No maximum result set size on `src/app/api/agendamentos/route.ts` query. As studio gains members, single request can fetch thousands of records.
- Impact: Slow API responses; memory pressure; frontend struggles to render large lists
- Scaling path: Implement cursor-based pagination; add reasonable default limits; index queries on date range to improve DB performance

**PDF generation in-memory:**
- Issue: `src/lib/pdf.ts` builds entire PDF document before writing. Large training plans will consume significant memory per request.
- Impact: Out-of-memory errors under concurrent PDF generation load
- Scaling path: Implement streaming; consider server-side caching of generated PDFs; use headless browser if rendering templates

**Email sending is synchronous and not queued:**
- Issue: Email sends in `src/lib/resend.ts` are awaited in request handlers. If Resend API is slow or down, requests hang. Multiple concurrent emails could saturate connection pool.
- Impact: Slow requests; potential timeouts; poor user experience during email sends
- Scaling path: Implement job queue for email sending (Bull, Upstash); make email sends asynchronous

## Dependencies at Risk

**NextAuth.js beta version (5.0.0-beta.30):**
- Risk: Using beta version of authentication library. Breaking changes possible in minor updates; bugs may exist.
- Impact: Auth could break unexpectedly on dependency updates; security issues in beta might not be backported
- Migration plan: Plan migration to stable NextAuth v5 release or switch to Auth0/Supabase Auth for production stability

**pdfkit (0.17.2) - unmaintained:**
- Risk: PDFKit is community-maintained with infrequent updates. Font handling and edge cases may have unfixed bugs.
- Impact: PDF generation bugs could be difficult to fix; security vulnerabilities in rendering
- Migration plan: Consider alternatives like puppeteer + HTML-to-PDF for complex layouts, or prebuilt PDF generation services

**Prisma with PostgreSQL only:**
- Risk: Direct dependency on PostgreSQL. Connection pooling via DIRECT_URL but primary pool connection is standard. Supabase/Railway/others may have quirks.
- Impact: Difficult to migrate databases; vendor lock-in risk
- Migration plan: Ensure schema migrations are version-controlled; test disaster recovery procedures; have backup provider ready

## Missing Critical Features

**No audit logging for sensitive operations:**
- Problem: No audit trail for who modified payments, removed members, or changed schedules. Admin actions not tracked.
- Blocks: Compliance requirements; impossible to investigate discrepancies
- Files: `src/app/api/membros/route.ts`, `src/app/api/pagamentos/route.ts`, `src/app/(admin)/financeiro/page.tsx`
- Recommendation: Add audit_logs table; log user ID, action, timestamp, before/after state for sensitive operations

**No soft delete or data recovery:**
- Problem: `deleteMany()` calls permanently remove records. No way to recover accidentally deleted data.
- Blocks: Data recovery after accidental deletion; compliance with data retention policies
- Files: `src/app/api/agendamentos/[id]/route.ts` (lines 225, 282, 293)
- Recommendation: Implement soft deletes (deleted_at timestamp); add admin interface to view/restore deleted records

**No rate limiting on public/auth endpoints:**
- Problem: No visible rate limiting on signup, login, password reset. Vulnerable to brute force attacks.
- Blocks: Security against credential stuffing and account enumeration
- Files: `src/app/api/auth/**/*.ts`
- Recommendation: Integrate Upstash Rate Limit (`@upstash/ratelimit` already in package.json); add per-IP/per-email limits

**No role-based feature flags:**
- Problem: No way to gradually roll out features or disable functionality for certain users without code changes.
- Blocks: A/B testing; gradual rollouts; emergency feature shutdown
- Recommendation: Add feature flag system (LaunchDarkly, Vercel Flags, or custom); use feature flag logic in components and API routes

---

*Concerns audit: 2026-02-11*
