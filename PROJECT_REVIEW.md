# Project Review

Current-state review of the codebase as of 2026-04-01.

## Verdict

The project is useful, but the engineering discipline is uneven.

The good news:

- The monolith choice is correct for the product.
- The Prisma schema is mostly coherent.
- The payment import subsystem is better designed than the rest of the app.
- The test suite is real and catches a lot.

The bad news:

- The project has too many boundary leaks.
- Operational contracts are not consistently reflected in code.
- Several important flows work by coincidence or by compensating shortcuts.
- The documentation is no longer a reliable source of truth.

This is not a bad prototype. It is a decent product codebase with obvious maintenance debt and a few real defects that should not be in production.

## Findings

### 1. Critical: the healthcheck contract is broken

The repository claims `/api/health` is a public infrastructure endpoint, but the implementation still requires authentication.

Evidence:

- `src/middleware.ts` exposes `/api/health` as public.
- `src/app/api/health/route.ts` wraps the handler in `withApiAuth()`.
- `Dockerfile` uses unauthenticated `wget http://localhost:3000/api/health` as the container healthcheck.

Impact:

- Docker or self-hosted healthchecks will fail unless they carry an auth session.
- The code and the deployment contract disagree.

Truth:

This is not a subtle architecture issue. It is an operational bug.

### 2. High: the notification cron topology is incoherent and can duplicate billing reminders

Two separate cron paths send payment reminders at the same schedule:

- `/api/cron/tarefas-diarias`
- `/api/cron/cobrancas-whatsapp`

They are both scheduled at `0 12 * * *` in `vercel.json`.

Evidence:

- `vercel.json`
- `src/app/api/cron/tarefas-diarias/route.ts`
- `src/app/api/cron/cobrancas-whatsapp/route.ts`
- `src/lib/scheduler.ts`
- `src/lib/jobs/cobranca-whatsapp.ts`

Impact:

- The daily scheduler already processes cobranças.
- The dedicated WhatsApp job also processes cobranças.
- Their dedupe logic is different, so this is not one pipeline with two entrypoints. It is two pipelines.

Truth:

This is how projects start sending duplicate messages to customers and then pretending the bug is “intermittent.”

### 3. High: the scheduler can permanently suppress failed notifications

The generic scheduler creates a `notificacao` row before sending the message. If sending fails, the row remains in the database as unsent. On the next run, the scheduler sees an existing record and skips the item entirely.

Evidence:

- `src/lib/scheduler.ts`
  - `processNotifications()` checks `findFirst()` and skips any existing notification.
  - It creates the notification before calling `sendEmail`/`sendWhatsapp`.
  - It only marks `enviada = true` after the send succeeds.

Impact:

- One delivery failure can become a permanent missed reminder.
- Retry semantics are broken.
- The failure mode is silent unless someone inspects logs manually.

Truth:

This is the kind of defect that makes a system look “mostly fine” while quietly dropping customer communications.

### 4. High: the scheduler under-notifies members who have multiple payments due

`processarCobrancas()` iterates over payments individually, but deduplicates notifications only by member and type inside a 24-hour window.

Evidence:

- `src/lib/scheduler.ts`
  - `pagamentos` are fetched one row at a time.
  - `processNotifications()` dedupes on `membroId + tipo + createdEm >= since`.
  - The built message is per payment, not per member aggregate.

Impact:

- If a member has multiple pending payments due in the same window, only the first payment is represented.
- The second and later items are skipped because a notification was already created for that member.

Truth:

The dedicated WhatsApp job groups payments by member correctly. The scheduler path does not. The notification subsystem is inconsistent even inside the same domain.

### 5. High: recurring-schedule “future” edits and deletes operate from today, not from the selected occurrence

When the user edits or deletes a recurring appointment with `scope = future`, the code deletes appointments with `data >= hoje`, not `data >= agendamento.data`.

Evidence:

- `src/app/api/agendamentos/[id]/route.ts`
  - PATCH future branch deletes rows from `hoje`.
  - DELETE future branch also deletes rows from `hoje`.

Impact:

- Editing a future occurrence can modify or delete earlier upcoming occurrences that the user did not select.
- The semantics of “future” are wrong.

Truth:

This is a real business-logic bug, not just an architectural preference.

### 6. Medium: schedule reads perform writes

`GET /api/agendamentos` calls `syncAgendamentosRecorrentes()`, which may create missing slots and appointments.

Evidence:

- `src/app/api/agendamentos/route.ts`
- `src/services/agendamento.service.ts`

Impact:

- A read endpoint mutates the database.
- Read latency depends on write work.
- Race conditions and capacity edge cases become harder to reason about.
- Caching becomes risky because reads are no longer pure.

Truth:

This is a pragmatic shortcut, but it is still a shortcut.

### 7. Medium: timezone handling is fragmented and will eventually bite

The project does not have one canonical timezone policy.

Evidence:

- `src/app/(admin)/dashboard/page.tsx` hardcodes `America/Cuiaba`
- `src/lib/jobs/cobranca-whatsapp.ts` defaults to `America/Sao_Paulo`
- `.env.example` exposes `APP_TIMEZONE="America/Sao_Paulo"`
- `src/lib/schedule.ts` and `src/services/agendamento.service.ts` normalize dates to noon to work around timezone shifts

Impact:

- “today,” “tomorrow,” due dates, and schedule windows are not based on one clock.
- Bugs will cluster around midnight boundaries, DST assumptions, and reporting.

Truth:

The codebase knows it has a date problem and is handling it with scattered local fixes.

### 8. Medium: the member dashboard knowingly shows the wrong “next class”

The member home page explicitly accepts that it may display a class from earlier today as the “next” class.

Evidence:

- `src/app/(aluno)/inicio/page.tsx`
  - comment says the result may still show a class from earlier today
  - query filters on `data >= todayStart`, not on actual slot time

Impact:

- The “Próxima Aula” card can be wrong.

Truth:

The code literally documents the bug and ships it anyway.

### 9. Medium: redirect policy has drifted into dead or wrong routes

There are redirects to routes that do not match the current route structure.

Evidence:

- `src/app/(admin)/layout.tsx` redirects to `/meus-dados`
- `src/app/(admin)/alunos/[id]/page.tsx` redirects to `/meus-dados`
- `src/app/(auth)/verificar-email/[token]/page.tsx` can push to `/admin`
- Current real member/admin routes are `/meu-perfil` and `/dashboard`

Impact:

- Unauthorized or edge-case navigation can land on non-existent paths.
- This is a sign that route policy is duplicated and not centrally maintained.

Truth:

When redirect targets are wrong, the project is telling you that nobody owns navigation policy end-to-end.

### 10. Medium: the training-create API has a validation hole that can turn user error into a server error

`membroId` is optional in the schema, but the route passes `membroId || ''` to the create service.

Evidence:

- `src/schemas/treino.schema.ts`
- `src/app/api/treinos/route.ts`
- `src/services/treino.service.ts`

Impact:

- Missing `membroId` is not rejected cleanly at the boundary.
- Instead, the request can fall through into a Prisma-level failure.

Truth:

This is lazy boundary validation.

### 11. Medium: the project documentation is not trustworthy

There is too much drift between docs and code.

Examples:

- `docs/REPO_MAP.md` lists `docker-compose.yml`, `npm run dev`, `npm run dev:local`, `src/app/api/cron/tarefas-email/route.ts`, and `utility/import-payments-feb-2026-docx.ts`
- `package.json` has no `dev` or `dev:local` scripts
- there is no `docker-compose.yml`
- there is no `src/app/api/cron/tarefas-email/route.ts`
- there is no `utility/import-payments-feb-2026-docx.ts`
- `docs/ARCHITECTURE.md` still describes `docker-compose.yml` as part of the active topology
- `docs/DECISIONS/notifications.md` still references `tarefas-email`
- `docs/ARCHITECTURE.md` says production rate limiting is fail-open, but `src/lib/rate-limit.ts` now fails closed in production

Impact:

- New contributors cannot trust the docs.
- Operational assumptions can be wrong even when documented.

Truth:

Once docs become aspirational instead of factual, they stop being documentation and start being fiction.

### 12. Small but important: the health tests miss the real bug

The health tests mock `withApiAuth()` as already authenticated, so they never exercise the actual public-healthcheck contract.

Evidence:

- `src/__tests__/api/health.test.ts`

Impact:

- The test suite passes while the operational contract is still wrong.

Truth:

This is a test blind spot, not test coverage.

### 13. Small: the code reuses password-reset tokens as profile-completion tokens

The profile completion flow resolves users by `tokenReset`, which is also the password reset token field.

Evidence:

- `src/app/api/perfil/route.ts`
- `src/app/api/auth/enviar-reset-senha/route.ts`
- `src/app/api/auth/redefinir-senha/route.ts`
- `src/app/api/auth/validar-token-reset/route.ts`

Impact:

- Two unrelated workflows share one token namespace.
- This increases coupling and makes the auth model harder to reason about.

Truth:

This is not catastrophic, but it is a cheap shortcut in a sensitive part of the system.

### 14. Small: runtime and dependency hygiene are sloppy

Evidence:

- `@prisma/client` is in `devDependencies` even though the application uses it at runtime.
- `@auth/prisma-adapter` is installed but unused anywhere in the source tree.

Impact:

- The dependency model is noisier than it should be.
- Runtime-vs-build expectations are less clear.

Truth:

This is the sort of small mess that accumulates when nobody periodically prunes the edges.

### 15. Small: default lint ergonomics are poor

The default lint command is `eslint`, and the ESLint ignore list only excludes top-level `.next/**`. In practice, local generated `.next` artifacts under nested assistant worktrees are still traversed.

Evidence:

- `package.json`
- `eslint.config.mjs`
- `.gitignore`

Impact:

- `npm run lint` is not a clean signal in this workspace unless the environment is spotless.

Truth:

This is not a production bug, but it is another sign that tooling boundaries are not maintained carefully.

### 16. Small: the verification page has dead or misleading admin logic

The verification UI checks `data.isAdmin` and can redirect to `/admin`, but the API always returns `isAdmin: false`, and the actual admin landing route is `/dashboard`.

Evidence:

- `src/app/api/auth/verificar-email/route.ts`
- `src/app/(auth)/verificar-email/[token]/page.tsx`

Impact:

- The branch is dead today.
- If it ever becomes live, it points to the wrong place.

Truth:

This is small, but it is exactly the kind of drift that hints at unfinished refactors.

### 17. Small: the home page force-completes onboarding for any legacy user who merely has a `membro` row

Evidence:

- `src/app/page.tsx`

Impact:

- The project is using a broad shortcut to clean up legacy state.
- Users can be marked as fully onboarded without the code verifying the real completeness of their data.

Truth:

This is expedient, but it is not clean state management.

## What The Project Gets Right

- The system is still better than many small-business apps because it has real tests, types, and a decent schema.
- The payment import pipeline is the strongest subsystem in the repository.
- The monolith choice is still correct.

## Final Judgment

The project is not a mess, but it is not a disciplined codebase either.

It has a solid product core and a workable architecture, but too many corners are being held together by duplicated policies, route-level logic, and stale assumptions. The codebase feels like a team that made several correct top-level choices and then stopped doing the boring maintenance work needed to keep those choices coherent.

If nothing changes, the code will continue to work, but it will get more expensive to trust.

That is the real problem here: not performance, not scale, not framework choice. Trust.

