# Simplifications

This document identifies overcomplicated code that a senior engineer would flag for simplification.

---

## 1. `src/app/(admin)/financeiro/page.tsx` (1,577 lines)

**Problem:** This is a "god component" that handles too many responsibilities:
- Plans CRUD (list, create, edit, delete, toggle active)
- Payments CRUD (list, create, edit, delete, status updates)
- Statistics display
- Multiple dialogs (plano dialog, pagamento dialog, delete confirmation)
- Pagination state management
- Filtering and sorting
- 20+ useState hooks managing various states

**How to simplify:**
1. Extract `PlanoCard` component for rendering individual plan cards
2. Extract `PagamentoTable` component for the payments table
3. Extract `PlanoDialog` and `PagamentoDialog` into separate components
4. Create `useFinanceiroData` hook to handle data fetching (planos, pagamentos, membros, stats)
5. Create `usePlanoForm` and `usePagamentoForm` hooks for form state/validation
6. Extract the plan category rendering (planosGabi, planosEstagiarios, planosOutros) into a `PlanoCategorySection` component - this pattern is repeated 3 times with ~90 lines each

---

## 2. `src/lib/resend.ts` (894 lines)

**Problem:** Contains 8 large HTML email templates as inline string literals with massive duplication:
- Every template repeats the same ~80 lines of header/footer structure
- Same styling patterns copy-pasted across all templates
- Hard to maintain - changing the brand color requires edits in ~50 places

**How to simplify:**
1. Extract common email layout into a reusable function that accepts content sections
2. Create a base template with slots for: icon, title, body content, and CTA button
3. Each email type becomes just ~20 lines defining the unique content
4. Consider using React Email or MJML for more maintainable email templates

Example refactored structure:
```typescript
const baseEmailLayout = (options: {
  icon: string;
  title: string;
  content: string;
  ctaText?: string;
  ctaUrl?: string;
  warningText?: string;
}) => `...single template with variables...`

emailTemplates.lembreteAula = (nome, horario, data) =>
  baseEmailLayout({
    icon: 'calendar',
    title: 'Lembrete de aula',
    content: `Olá ${nome}! Sua aula está agendada...`,
    ctaText: 'Acessar o site',
    ctaUrl: 'https://studiogabirego.com'
  })
```

---

## 3. Anamnese Form Duplication

**Files:**
- `src/app/(admin)/alunos/[id]/anamnese/page.tsx` (740 lines)
- `src/app/(auth)/anamnese/page.tsx` (684 lines)

**Problem:** These two pages have nearly identical:
- `AnamneseData` interface (duplicated)
- Form fields (all ~25 questions are copy-pasted)
- Field update logic
- PAR-Q section
- Medical history section

**How to simplify:**
1. Create a shared `AnamneseFormFields` component in `src/components/forms/`
2. Create shared `anamneseFields` configuration object defining all questions
3. Each page only handles its unique aspects:
   - Admin page: member selection header, admin-specific actions
   - Auth page: onboarding flow, collapsible sections, progress indicator
4. Share the `AnamneseData` type from a central location (e.g., `src/types/anamnese.ts`)

---

## 4. Training Editor Duplication

**Files:**
- `src/app/(admin)/treinos/gerador/page.tsx` (772 lines)
- `src/app/(admin)/treinos/[id]/editar/page.tsx` (660 lines)

**Problem:** Both files implement the same:
- Session management (add, remove, reindex)
- Exercise management (add, update, remove)
- Exercise history (save to localStorage)
- Session card UI with exercise grid
- Full session name composition (`getFullSessionName`)
- PDF generation logic

**How to simplify:**
1. Extract `TrainingEditorForm` component that handles sessions/exercises UI
2. Create `useTrainingEditor` hook consolidating session/exercise state management
3. Keep page-specific logic separate:
   - `gerador`: member selection, template application, create new
   - `editar`: load existing, delete functionality
4. The editor helpers in `src/lib/treino/editor.ts` already exist but the pages duplicate the state management patterns

---

## 5. Plan Selector/Category UI Duplication

**Files:**
- `src/app/(admin)/financeiro/page.tsx` (lines 774-821, 1308-1567)
- `src/components/forms/MemberForm.tsx` (lines 428-475)

**Problem:** The grouped plan selector UI (planosGabi, planosEstagiarios, planosOutros) is repeated 3+ times with:
- Same SelectGroup structure
- Same color indicators (amber, sky, violet)
- Same label formatting
- ~50 lines duplicated each time

**How to simplify:**
1. Create `GroupedPlanSelect` component that takes:
   - `value`, `onChange`, `disabled` props
   - Internally uses `groupPlansByCategory`
2. Create `PlanCategoryCards` component for the financeiro page's plan display
3. Both share the same category indicator styling

---

## 6. `src/components/forms/MemberForm.tsx` (615 lines)

**Problem:**
- All form fields inline in one component
- Validation schema, form logic, and UI all mixed together
- Long list of FormField components could be generated from configuration

**How to simplify:**
1. Extract `HorariosFixosSection` component (lines 512-594)
2. Consider a field config approach for standard fields:
```typescript
const memberFields = [
  { name: 'nome', label: 'Nome Completo', type: 'text' },
  { name: 'email', label: 'Email', type: 'email' },
  // ...
]
```
3. Extract the password field section (with send reset link) into `PasswordFieldWithReset`

---

## 7. Schedule Hook Data Fetching Pattern

**File:** `src/hooks/use-schedule.ts` (316 lines)

**Problem:**
- `createAgendamento` and `moveAgendamento` both call `/api/horarios/get-or-create` then the agendamentos endpoint
- Same error handling pattern repeated across 5 functions
- Could benefit from extracting common fetch-with-toast pattern

**How to simplify:**
1. Extract `getOrCreateHorario` helper function
2. Create generic `apiCall` helper that handles try/catch and toast messages:
```typescript
const apiCall = async <T>(
  fn: () => Promise<Response>,
  successMsg: string,
  errorMsg: string
): Promise<T | null> => { ... }
```

---

## 8. API Route Response Patterns

**Multiple API routes have similar patterns:**
- Error handling with try/catch
- NextResponse.json with status codes
- Similar validation patterns

**How to simplify:**
1. Create `apiHandler` wrapper that:
   - Handles authentication check
   - Wraps in try/catch
   - Standardizes error response format
2. Reduces boilerplate in each route handler

---

## Summary Priority

| Priority | File | Effort | Impact |
|----------|------|--------|--------|
| High | `financeiro/page.tsx` | Medium | High - Most complex file, hard to maintain |
| High | Anamnese duplication | Low | Medium - Clear DRY violation |
| High | Training editor duplication | Low | Medium - Clear DRY violation |
| Medium | `resend.ts` | Medium | Medium - Email maintenance pain point |
| Medium | Plan selector duplication | Low | Low - Small but repetitive |
| Low | `MemberForm.tsx` | Medium | Low - Works fine, just long |
| Low | Schedule hook | Low | Low - Minor optimization |
