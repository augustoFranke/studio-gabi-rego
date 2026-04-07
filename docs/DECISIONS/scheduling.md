# Recurring Schedule Model

## Status
Observed

## Context
The studio needs daily bookings plus recurring weekly patterns, with slot capacity limits and member-plan weekly caps.

## Decision
Model scheduling with three primitives:
- `horarios_disponiveis` (global slot definitions/capacity)
- `agendamentos` (date-bound bookings)
- `horarios_fixos` (member recurring weekly commitments)

Keep recurrence materialization on controlled write or job paths rather than on ordinary reads.
Push recurring/future-scope mutation rules into `src/services/agendamento.service.ts` so route handlers stay thin.

## Alternatives Considered (Inferable)
- Store only recurring rules and generate views at render time.
- Store only explicit date bookings without recurrence objects.
- Offload recurrence management to external calendar service.

## Consequences
Pros:
- Clear distinction between slot inventory and member recurrence intent.
- Deterministic booking generation and capacity checks.
- Supports scoped operations (`single` vs `future`) for edits/deletes.
- Read endpoints remain side-effect free.

Cons:
- More complex sync/update logic with multi-entity coordination.
- Requires careful timezone/date normalization.

## Impacted Areas
- `prisma/schema.prisma` (`HorarioDisponivel`, `Agendamento`, `HorarioFixo`)
- `src/services/agendamento.service.ts`
- `src/app/api/agendamentos/route.ts`
- `src/app/api/agendamentos/[id]/route.ts`

## Evidence
Files:
- `prisma/migrations/20260128130000_add_horarios_fixos/migration.sql`
- `src/services/agendamento.service.ts` (recurrence sync + plan limit checks)
- `src/app/api/agendamentos/*.ts` (scope handling, capacity checks)
- `src/__tests__/api/agendamentos.test.ts`, `src/__tests__/api/agendamentos-id.test.ts`

Commits:
- `8f771b7` - introduced fixed schedule model.
- `3ef8cd4` - schedule/service performance refinements.
