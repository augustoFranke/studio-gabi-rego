# Cron-Driven Notifications

## Status
Observed

## Context
The product needs automated reminders (classes, payments, birthdays) across email and WhatsApp channels, with duplicate prevention.

## Decision
Implement internal cron endpoints protected by `CRON_SECRET` and process notifications via a scheduler module that:
- computes candidate items
- deduplicates against existing notifications
- sends channel messages when configured
- persists delivery status, attempts, and errors in DB
- keeps one canonical cobrança reminder pipeline instead of parallel reminder paths

## Alternatives Considered (Inferable)
- Always-on in-process scheduler only.
- External queue-only architecture (without in-app cron handlers).
- Channel-specific independent pipelines.

## Consequences
Pros:
- Unified orchestration and dedupe logic in one module.
- Channel support is extensible (email and WhatsApp hooks).
- Testable endpoint contracts.
- Retryable delivery state is visible in the database.

Cons:
- Trigger orchestration is external to repo and must be configured correctly.
- Partial failures require operational monitoring.

## Impacted Areas
- `src/lib/scheduler.ts`
- `src/lib/jobs/cobranca-whatsapp.ts`
- `src/lib/whatsapp/evolution.ts`
- `src/app/api/cron/cobrancas-whatsapp/route.ts`
- `src/app/api/cron/tarefas-diarias/route.ts`

## Evidence
Files:
- `src/lib/scheduler.ts` (batch processing, dedupe, channel sends)
- `src/app/api/cron/*/route.ts` (Bearer secret checks)
- `src/__tests__/api/cron-cobrancas-whatsapp.test.ts`
- `src/__tests__/api/cron-tarefas-email.test.ts`

Commits:
- `9702602` - notification + cron capability introduced.
- `8df24b4` - cron auth tightening/security hardening.
- `3ef8cd4` - scheduler performance optimization.
