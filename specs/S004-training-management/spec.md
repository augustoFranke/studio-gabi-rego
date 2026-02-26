# S004-training-management

## Summary
Training management allows admins to create/version member training sheets, derive templates, and generate PDFs while members can read their own active plan and download PDF.

## User-facing behavior
- Admin can create, update, delete training sheets and manage template library.
- New admin-created sheet deactivates prior active sheets for that member.
- Member view displays exercises grouped by session and supports PDF download.

## Functional requirements
- MUST restrict training create/update/delete/template APIs to admin role.
- MUST scope member reads to own training resources.
- MUST normalize/massage exercise payloads (default session/name/series/reps) when incomplete.
- MUST support PDF generation from either ad-hoc payload or persisted training sheet.
- MUST return downloadable PDF responses with proper content headers.
- SHOULD allow template creation from existing training sheet (`fichaId`) when provided.

## Non-goals
- Real-time collaborative training editor.
- External workout provider sync.

## UX notes
- Member page defaults to first active sheet and tabbed session display.
- Admin list page shows active sheets and PDF quick action.
- Training generator template/member pickers are searchable and alphabetically ordered.

## Data model/storage
- `fichas_treino`, `exercicios`, `treinos_template`, `treinos_template_exercicios`.

## API/contracts
- `GET|POST /api/treinos`
- `GET|PUT|DELETE /api/treinos/[id]`
- `GET|POST /api/treinos/templates`
- `POST /api/treinos/gerar-pdf`
- `GET /api/treinos/[id]/pdf`

## Edge cases
- Missing required PDF fields returns `400`.
- Empty-session PDF payloads return `400`.
- Nonexistent training id returns `404`.

## Telemetry/analytics
- No analytics events detected; errors logged server-side.

## Security/privacy considerations
- Owner-or-admin checks gate per-sheet reads and PDF download.
- PDF generation uses server-side assets and sanitized filenames.

## Acceptance criteria
- Member GET `/api/treinos` scopes to session member and defaults to active-only.
- POST `/api/treinos` deactivates prior active sheets before create.
- PUT `/api/treinos/[id]` replaces exercises when array is provided.
- PDF endpoints return `application/pdf` and `500` on generation failures.

## Evidence
- `src/app/api/treinos/*.ts`
- `src/app/api/treinos/[id]/*.ts`
- `src/services/treino.service.ts`
- `src/lib/pdf.ts`
- `src/app/(aluno)/meu-treino/page.tsx`
- `src/__tests__/api/treinos.test.ts`
- `src/__tests__/api/treinos-id.test.ts`
- `src/__tests__/api/treinos-templates.test.ts`
- `src/__tests__/api/treinos-gerar-pdf.test.ts`
- `src/__tests__/api/treinos-id-pdf.test.ts`
