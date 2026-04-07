# Audited Payment Import Pipeline

## Status
Observed

## Context
A high-risk operational need exists to import month payments from DOCX exports while preserving traceability, safe dry runs, idempotency, and rollback.

## Decision
Use a dedicated import subsystem with:
- deterministic row parsing and name matching
- dry-run and apply modes
- idempotency via `import_key`
- run/log audit tables (`pagamento_import_runs`, `pagamento_import_logs`)
- rollback by batch/run linkage
- support for unmatched payer rows (`membro_id` nullable + `payer_nome`)

## Alternatives Considered (Inferable)
- Direct one-off SQL inserts with no audit tables.
- CSV-only ingestion without DOCX parser.
- Manual UI-only reconciliation.

## Consequences
Pros:
- Strong operational auditability.
- Safe rehearsal mode before writes.
- Repeat-safe apply behavior.

Cons:
- Additional schema and operational complexity.
- Matching thresholds may still produce ambiguous/manual follow-up cases.

## Impacted Areas
- `src/lib/payments/feb2026-import.ts`
- `utility/import-payments-feb-2026-docx.ts`
- `prisma/migrations/20260223103841_add_pagamento_import_audit/migration.sql`
- `RUNBOOK.md`

## Evidence
Files:
- `src/lib/payments/feb2026-import.ts` (matching logic, run/log writes, rollback)
- `utility/import-payments-feb-2026-docx.ts` (CLI modes and report output)
- `RUNBOOK.md` (operational apply/verify/rollback steps)
- `src/__tests__/lib/feb2026-import.test.ts`

Commits:
- `70fb9fe` - introduced audited Feb/2026 import architecture.
- `3274441` - follow-up fix for payment import status/local ops flow.
