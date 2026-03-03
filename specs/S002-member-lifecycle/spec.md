# S002-member-lifecycle

## Summary
Member lifecycle covers admin-managed member CRUD/status operations and member self-service profile updates, with validation and uniqueness constraints.

## User-facing behavior
- Admin can list, filter, create, and edit members.
- Admin can set status transitions and deactivate member records for follow-up workflows.
- Members can view and update their own profile fields (`nome`, `telefone`, `dataNascimento`, `sexo`).

## Functional requirements
- MUST restrict member-create/update APIs to admin role.
- MUST validate CPF and email format/uniqueness before create/update.
- MUST allow optional profile fields while preserving validation on provided values.
- MUST support admin-created members without a real email using placeholder semantics.
- MUST set newly admin-created members as active and onboarding complete.
- MUST support member self-profile update through authenticated `/api/perfil`.
- SHOULD enforce plan-vs-fixed-slot count validation when fixed weekly slots are provided.

## Non-goals
- Public self-signup management of arbitrary member records.
- Complex workflow engines for lifecycle states beyond current status enum.

## UX notes
- Admin list UI supports filtering/search/sort and inline action menus.
- Data-driven plan selectors in admin member flows use searchable dropdowns with alphabetical ordering inside each plan group.
- Member profile page exposes editable personal fields with save feedback.

## Data model/storage
- `membros` + linked `usuarios`.
- Optional `horarios_fixos` records embedded in admin create/update flows.

## API/contracts
- `GET|POST /api/membros`
- `GET|PATCH /api/membros/[id]`
- `GET|PUT|POST /api/perfil`
- Server actions: `toggleMembroStatus`, `deleteMembro`, `deactivateMembro`

## Edge cases
- Duplicate email/CPF returns `400` and must not persist partial writes.
- Empty email during update is converted to placeholder local address.
- Missing member on update returns `404`.

## Telemetry/analytics
- No explicit analytics instrumentation found.

## Security/privacy considerations
- Admin-only mutation paths protect broad member data edits.
- Hard-delete action cascades related data when deleting a user/member.

## Acceptance criteria
- Creating member with unique email/CPF returns `201` and creates `usuario` + `membro`.
- Duplicate email or CPF returns `400` in member-create path.
- Editing non-existent member returns `404`.
- Invalid profile payload returns validation error in profile endpoint tests.

## Evidence
- `src/app/api/membros/route.ts`
- `src/app/api/membros/[id]/route.ts`
- `src/app/api/perfil/route.ts`
- `src/app/actions/membros.ts`
- `src/__tests__/api/membros.test.ts`
- `src/__tests__/api/membros-id.test.ts`
- `src/__tests__/api/perfil.test.ts`
- Commit: `8f771b7`
