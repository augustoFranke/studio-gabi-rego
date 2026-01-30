# Suggested Code Simplifications & Improvements

## 1. Extract Agenda Page State Management
**File:** `src/app/(admin)/agenda/page.tsx`
**Lines:** 25-150 (approx)
**Critique:** This "God Component" manages over 10 independent state variables for modals, drag-and-drop confirmations, selection scope, and loading states. This makes the UI logic hard to follow and test.
**Simplification:** Extract the modal and interaction logic into a custom hook `useAgendaInteractions()`. This hook should expose simple handlers like `openCreateModal`, `confirmDelete`, `handleDrop`, returning only the necessary state flags to the view.

## 2. Standardize API Request & Auth Middleware
**File:** All `src/app/api/**/route.ts`
**Critique:** Almost every API route manually validates Zod schemas (10+ lines of try/catch/if-error) and manually checks role permissions (e.g., `if role == MEMBRO && id != user.id`). This is repetitive and error-prone.
**Simplification:** 
1.  Create `validateRequest<T>(req, schema)`: Returns typed data or throws a standard 400 error.
2.  Create `ensureOwnerOrAdmin(session, ownerId)`: Standardizes the "User can only access their own data unless Admin" logic.

## 3. Centralize Schedule Data Transformation
**Files:** `src/components/schedule/daily-view.tsx`, `weekly-view.tsx`, `monthly-view.tsx`
**Critique:** Each view component manually iterates over the raw `agendamentos` array to group them by hour/date using `useMemo`. This logic is duplicated three times.
**Simplification:** Move this transformation logic into `src/hooks/use-schedule.ts` (or a new `useScheduleData`). The view components should receive a pre-calculated `Map<Date/Hour, Event[]>` or a specialized data structure ready for rendering.

## 4. Implement Recurring Schedule Logic (Missing Feature)
**Files:** `src/lib/scheduler.ts`, `prisma/schema.prisma`
**Critique:** The system has a `HorarioFixo` table (user preferences) and an `Agendamento` table (actual calendar events), but there is no automated logic to sync them. This forces manual data entry or one-off scripts.
**Simplification:** Implement a `generateRecurringAppointments()` function in `scheduler.ts`. This makes the `HorarioFixo` feature functional and simplifies the user's manual workload.

## 5. Deduplicate Notification Logic
**File:** `src/lib/scheduler.ts`
**Critique:** `processarLembretesAula`, `processarCobrancas`, and `processarAniversarios` share identical "Query -> Check Duplicate -> Send -> Update" workflows.
**Simplification:** create a generic `processNotificationBatch<T>` function that accepts the query delegate and the message template formatter.

## 6. Abstract Filter & URL State Logic
**File:** `src/components/admin/alunos-filters.tsx`
**Critique:** The component manually syncs 4 separate state variables with URL search params using complex `useEffect` hooks and debouncing.
**Simplification:** Create a reusable `useUrlFilters(defaultFilters)` hook. This abstracts the "State <-> URL" bidirectional binding and debouncing, making the component code declarative.

## 7. Centralize Plan Business Logic
**Files:** `src/components/forms/MemberForm.tsx`, `src/components/admin/alunos-filters.tsx`
**Critique:** The business rule "Plans are categorized as Gabi / Estagiários / Outros" is hardcoded in multiple UI components.
**Simplification:** Move `groupPlansByCategory(plans)` to `src/domain/financeiro.ts`. If this rule changes (e.g., a new category "Nutrição"), you update it in one place.

## 8. Simplify PDF Generation
**File:** `src/lib/pdf.ts`
**Critique:** The `generateTrainingPDF` function is a single long function mixing data retrieval, layout calculation, and PDF drawing commands.
**Simplification:** Extract a `TableDrawer` class to handle the grid layout math. This separates the "How to draw a table" logic from the "What to put in the report" logic.

## 9. Unify Test Mocks
**File:** `src/__tests__/**`
**Critique:** Every test file re-declares mocks for `prisma` and `next-auth`.
**Simplification:** Create a `src/__tests__/setup.ts` or `src/__tests__/test-utils.ts` to export shared mocks.

## 10. Refactor Schema Definition
**File:** `src/schemas/membro.schema.ts`
**Critique:** `membroUpdateSchema` is a copy-paste of `membroCreateSchema` with minor changes.
**Simplification:** Define `membroUpdateSchema = membroCreateSchema.partial()`.