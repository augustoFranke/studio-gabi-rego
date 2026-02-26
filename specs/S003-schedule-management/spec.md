# S003-schedule-management

## Summary
Scheduling supports one-off and recurring bookings with slot capacity checks, ownership restrictions, and admin controls for future-series updates/deletions.

## User-facing behavior
- Admin can create, move, edit, and delete bookings from agenda views.
- Members can view only their own bookings.
- Weekly recurrence option creates fixed-slot commitments and future auto-generation.

## Functional requirements
- MUST enforce capacity per slot before booking creation/update.
- MUST prevent duplicate booking for same member/slot/date.
- MUST scope member requests to their own `membroId`.
- MUST allow admin to choose booking scope (`single` vs recurring/future) on update/delete.
- MUST validate fixed-slot limits against member plan weekly class count.
- MUST create missing `horario_disponivel` records on-demand for chosen day/hour in admin flow.
- SHOULD sync recurring bookings when querying date ranges that include present/future dates.

## Non-goals
- Public self-booking without authentication.
- External calendar provider sync.

## UX notes
- Admin agenda uses drag-and-drop and confirmation dialogs for future-scope operations.
- Admin create-booking member picker is searchable and alphabetically ordered by member name.
- Member agenda shows weekly attendance/status summaries.

## Data model/storage
- `horarios_disponiveis`, `horarios_fixos`, `agendamentos`, `membros`, `planos`.
- Unique index on (`membro_id`, `horario_id`, `data`) enforces de-dup at DB level.

## API/contracts
- `GET|POST /api/agendamentos`
- `GET|PATCH|DELETE /api/agendamentos/[id]`
- `GET|POST /api/horarios`
- `POST /api/horarios/get-or-create`

## Edge cases
- Full slot returns `400` on create/update.
- Updating/deleting with `future` scope changes fixed-slot linkage and future bookings.
- Invalid JSON payloads in patch/delete paths return `400`.

## Telemetry/analytics
- No dedicated scheduling analytics found; uses toast + logs.

## Security/privacy considerations
- Ownership and role checks prevent cross-member access.
- Member list fetch for scheduling uses active members and compact fields.

## Acceptance criteria
- Member GET on agendamentos ignores foreign `membroId` query and scopes to session member.
- Creating weekly booking beyond plan limit returns `400` with plan-limit message.
- Weekly-scope create path creates `horario_fixo` when missing.
- PATCH move path returns `400` for duplicate/invalid/inactive/full target slot.

## Evidence
- `src/app/api/agendamentos/route.ts`
- `src/app/api/agendamentos/[id]/route.ts`
- `src/services/agendamento.service.ts`
- `src/hooks/use-schedule.ts`
- `src/__tests__/api/agendamentos.test.ts`
- `src/__tests__/api/agendamentos-id.test.ts`
- Commits: `8f771b7`, `3ef8cd4`
