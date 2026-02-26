# S005-payment-management

## Summary
Payment management provides admin CRUD for plans/payments plus member-scoped payment history, including status transitions and searchable paginated finance views.

## User-facing behavior
- Admin can list, filter, sort, create, edit, cancel/remove payments.
- Admin can create/update/deactivate plans and inspect usage counts.
- Members can view only their own payment history.

## Functional requirements
- MUST restrict payment and plan mutation to admin role.
- MUST support payment list pagination with search/status/sort controls.
- MUST scope member payment reads by session `membroId`.
- MUST set `dataPagamento` on transition to `PAGO` and clear on `PENDENTE`/`CANCELADO` when status-driven.
- MUST cancel (not hard-delete) already-paid records on delete action.
- SHOULD include finance summary endpoint for dashboard metrics.

## Non-goals
- External payment gateway capture/settlement.
- Installments/chargeback reconciliation engine.

## UX notes
- Admin finance page is multi-tab and includes plan/payment dialogs.
- Payment dialog member and plan selectors are searchable and alphabetically ordered (plans ordered within each category group).
- Semantic/fixed selectors (status, recurrence, durations, yes/no style enums) keep intentional business order.
- Member payments page is read-only list with status badges.

## Data model/storage
- `planos`, `pagamentos`, status enum `StatusPagamento`.
- Payment relations to `membros` and `planos`.

## API/contracts
- `GET|POST /api/pagamentos`
- `GET|PUT|DELETE /api/pagamentos/[id]`
- `GET /api/financeiro/stats`
- `GET|POST /api/planos`
- `GET|PUT|DELETE /api/planos/[id]`

## Edge cases
- Invalid payment payloads return `400` and must not write.
- Deleting paid payment sets status canceled; pending payment may be deleted.
- Missing payment id returns `404`.

## Telemetry/analytics
- No explicit analytics found; finance stats endpoint is cache-controlled for lightweight dashboard polling.

## Security/privacy considerations
- Ownership checks prevent member access to other members' payments.
- Payer names can be persisted for unmatched import rows (PII consideration).

## Acceptance criteria
- Valid payment create returns `201` and persists expected fields.
- Invalid create payload returns `400`.
- Non-admin update/delete attempts return `403`.
- Paid delete path issues status update to `CANCELADO`.

## Evidence
- `src/app/api/pagamentos/route.ts`
- `src/app/api/pagamentos/[id]/route.ts`
- `src/app/api/planos/*.ts`
- `src/app/api/financeiro/stats/route.ts`
- `src/app/(admin)/financeiro/page.tsx`
- `src/app/(aluno)/pagamentos/page.tsx`
- `src/__tests__/api/pagamentos.test.ts`
- `src/__tests__/api/pagamentos-id.test.ts`
