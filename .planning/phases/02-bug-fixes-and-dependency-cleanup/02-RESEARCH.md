# Phase 2: Bug Fixes and Dependency Cleanup - Research

**Researched:** 2026-02-16
**Domain:** Next.js App Router mutation invalidation, anamnese response contract correctness, and dependency hygiene
**Confidence:** HIGH

## User Constraints

### Context Status
- No `CONTEXT.md` exists for Phase 2 (`.planning/phases/02-bug-fixes-and-dependency-cleanup/`).

### Locked Decisions (from phase brief / requirements)
- `BUG-01`: `revalidatePath` in member server actions must target `/alunos` (not `/membros`).
- `BUG-02`: Remove gender guessing in anamnese API responses; return `null` when `sexo` is not set in DB.
- `SEC-05`: `dompurify` and `isomorphic-dompurify` removed from `dependencies`; `pdf-lib` moved to `devDependencies` (not deleted).
- Sequence constraint: security first, refactoring later; this phase is post-Phase-1 hardening.

### Claude's Discretion (planning freedom)
- Decide whether BUG-02 should apply only to `GET /api/membros/[id]/anamnese` or also `GET /api/anamnese-token` (both currently guess from names).
- Define commit/test slicing and verification depth for dependency cleanup.

### Deferred Ideas (out of scope for this phase)
- `DATA-01` ANAMNESE field centralization (`/api/minha-anamnese`) is Phase 3.
- Broader refactors (financeiro split, SWR overhaul) are later phases.

## Summary

Phase 2 is a low-complexity, high-impact correction phase. All three requirements are already strongly localized: `BUG-01` is isolated to two incorrect `revalidatePath('/membros')` calls in `src/app/actions/membros.ts`; `BUG-02` is isolated to name-based fallback logic in anamnese GET routes; `SEC-05` is isolated to `package.json`/lockfile plus regression checks.

The main planning risk is scope drift, not implementation difficulty. The requirements text says "anamnese API" and "no guessing from names", while current heuristics exist in two endpoints (`/api/membros/[id]/anamnese` and `/api/anamnese-token`). Planning should treat both as in-scope unless the user explicitly narrows it, otherwise behavior stays inconsistent by entry point.

**Primary recommendation:** Plan this phase as 3 small, test-backed changes in order: (1) cache invalidation path fix, (2) remove sexo heuristics and enforce explicit-null contract, (3) dependency move/removal with lockfile and targeted test/build verification.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.1.1 | Server actions + route handlers | Existing mutation/invalidation boundary (`revalidatePath`, `router.refresh`) |
| Prisma Client | ^6.19.1 | Member and anamnese persistence | Existing DB access layer in all affected routes/actions |
| Vitest | ^4.0.17 | Regression tests | Existing suite already covers targeted actions/routes |
| npm + package-lock | lockfile present | Dependency state control | Required for safe dep move/remove in CI/deploy |

### Supporting
| Library/API | Version | Purpose | When to Use |
|-------------|---------|---------|-------------|
| `next/cache` `revalidatePath` | Next.js runtime | Invalidate route cache after mutation | Member status/delete actions |
| `next/navigation` `router.refresh()` | Next.js client | Re-fetch RSC payload after action success | Already used in member action UI |
| `pdf-lib` | ^1.17.1 | Test-only PDF parsing | Keep in `devDependencies` (used by PDF tests) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Keep `revalidatePath` string literals | Shared route constants | Constants reduce drift, but not required to satisfy Phase 2 |
| Heuristic sexo inference | Explicit DB-only sexo + `null` | Heuristic appears "helpful" but violates requirement and returns incorrect data |
| Blind dependency deletion | `rg` + targeted tests/build | Deletion is faster but unsafe for test-only packages (`pdf-lib`) |

**Installation / dependency commands for this phase:**
```bash
# Remove runtime-unused deps
npm uninstall dompurify isomorphic-dompurify

# Keep pdf-lib for tests only
npm uninstall pdf-lib
npm install -D pdf-lib@^1.17.1
```

## Architecture Patterns

### Recommended Project Structure
```text
src/
├── app/actions/membros.ts                    # BUG-01 revalidatePath corrections
├── app/api/membros/[id]/anamnese/route.ts    # BUG-02 remove heuristic fallback
├── app/api/anamnese-token/route.ts           # BUG-02 parity (recommended)
└── __tests__/
    ├── actions/membros.test.ts               # assert /alunos revalidation
    ├── api/membros-id-anamnese.test.ts       # assert null sexo when missing
    └── api/anamnese-token.test.ts            # assert null sexo when missing
```

### Pattern 1: Route-Accurate Revalidation
**What:** All member mutation server actions invalidate `/alunos`.
**When to use:** `toggleMembroStatus`, `deleteMembro`, `deactivateMembro`.
**Example:**
```typescript
revalidatePath('/alunos')
```

### Pattern 2: Explicit-Null Sexo Contract (No Guessing)
**What:** Return `null` when DB `sexo` is `null`; never infer from name.
**When to use:** Anamnese GET responses where sexo is returned.
**Example:**
```typescript
const sexo = membro.sexo
  ? (membro.sexo === 'FEMININO' ? 'Feminino' : 'Masculino')
  : null
```

### Pattern 3: Dependency Boundary by Runtime Usage
**What:** Production `dependencies` only for runtime imports; test-only libs stay in `devDependencies`.
**When to use:** Package cleanup tasks that affect bundle/runtime surface.
**Example:**
```bash
rg -n "from ['\\\"]pdf-lib['\\\"]|from ['\\\"](isomorphic-)?dompurify['\\\"]" src src/__tests__ utility
```

### Anti-Patterns to Avoid
- `revalidatePath('/membros')` anywhere in member actions (non-existent route, silent no-op).
- Keeping hardcoded `FEMALE_NAMES`/suffix heuristics in API code.
- Removing `pdf-lib` entirely (breaks `src/__tests__/pdf/generation.test.ts`).
- Editing `package.json` without lockfile update and regression checks.

## Don’t Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mutation freshness check | Ad-hoc client polling workarounds | Existing `router.refresh()` + correct `revalidatePath('/alunos')` | Already integrated; minimal change |
| Gender inference | Name dictionaries/suffix heuristics | Persisted DB field with explicit `null` | Requirement and correctness |
| Dependency usage validation | Guessing by memory | `rg` import scan + targeted tests/build | Prevents false "unused" classification |
| Package graph edits | Manual lockfile surgery | npm install/uninstall commands | Deterministic lockfile integrity |

**Key insight:** This phase is mostly contract correction and hygiene; avoid introducing new architecture.

## Common Pitfalls

### Pitfall 1: Fixing only one of the two wrong revalidation calls
**What goes wrong:** Toggle works/fails differently from delete due to partial patch.
**Why it happens:** `deactivateMembro` already uses `/alunos`, masking the duplicate issue.
**How to avoid:** Assert `revalidatePath('/alunos')` for all three actions in tests.
**Warning signs:** One mutation reflects immediately, another still needs hard refresh.

### Pitfall 2: Removing heuristic in only one endpoint
**What goes wrong:** Admin anamnese API returns `null`, token API still guesses from name.
**Why it happens:** Requirement text references singular "anamnese route", but code has two heuristic implementations.
**How to avoid:** Decide scope explicitly in plan; recommended default is both endpoints for "no guessing from names".
**Warning signs:** Different `sexo` for same member depending on endpoint.

### Pitfall 3: Null sexo response breaks implicit UI assumptions
**What goes wrong:** UI logic silently hides gender-specific questions without clear context.
**Why it happens:** Clients often check truthiness (`if (data.sexo)`) and previously received guessed values.
**How to avoid:** Keep `null` handling explicit in consuming pages and test missing-sexo scenarios.
**Warning signs:** Unexpected absence of female-specific fields after loading old profiles with no sexo.

### Pitfall 4: Dependency cleanup breaks tests/build pipeline
**What goes wrong:** Removing `pdf-lib` from runtime deps without adding to dev deps causes test failures.
**Why it happens:** `pdf-lib` is only imported in tests, so runtime grep can miss CI impact.
**How to avoid:** Move (not delete) `pdf-lib`, then run targeted and full test commands.
**Warning signs:** `Cannot find module 'pdf-lib'` in `src/__tests__/pdf/generation.test.ts`.

### Pitfall 5: Action response key mismatch obscures errors (adjacent risk)
**What goes wrong:** UI toasts read `result.error`, but actions now return `message`.
**Why it happens:** Phase 1 standardized action payloads to `{ success, message }`; UI still partially reads `error`.
**How to avoid:** Keep this noted in planning as adjacent cleanup if user-facing error text quality matters.
**Warning signs:** Generic fallback toast despite meaningful backend message.

## Code Examples

Verified current patterns and hotspots:

### BUG-01 hotspot (current wrong slug)
```typescript
// src/app/actions/membros.ts
revalidatePath('/membros') // should be '/alunos'
```

### BUG-02 hotspots (current heuristics)
```typescript
// src/app/api/membros/[id]/anamnese/route.ts
const sexo = membro.sexo
  ? (membro.sexo === 'FEMININO' ? 'Feminino' : 'Masculino')
  : determineSexo(membro)

// src/app/api/anamnese-token/route.ts
const sexo = membro.sexo ?? determineSexoEnum(membro.usuario.nome)
```

### SEC-05 evidence (test-only pdf-lib usage)
```typescript
// src/__tests__/pdf/generation.test.ts
import { PDFDocument } from 'pdf-lib'
```

### Verification command set (recommended for plan tasks)
```bash
npm run test:run -- src/__tests__/actions/membros.test.ts src/__tests__/api/membros-id-anamnese.test.ts src/__tests__/api/anamnese-token.test.ts
npm run test:run -- src/__tests__/pdf/generation.test.ts
npm run test:run
npm run build
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mixed route slugs for member invalidation | Single canonical `/alunos` | Phase 2 target | Eliminates stale admin list after mutation |
| Name-based inferred sexo fallback | DB-only sexo with `null` fallback | Phase 2 target | Removes incorrect data guessing |
| Test-only libs in runtime deps | Test-only libs in `devDependencies` | Phase 2 target | Smaller production dependency surface |

**Deprecated/outdated in this phase scope:**
- Name-based sexo inference in API routes.
- Runtime `dependencies` entries for packages with no runtime imports (`dompurify`, `isomorphic-dompurify`).

## Open Questions

1. **BUG-02 endpoint scope**
   - Should "anamnese API" include both `GET /api/membros/[id]/anamnese` and `GET /api/anamnese-token`?
   - Recommendation: Yes, include both to satisfy "no guessing from names" consistently.

2. **Sexo representation contract for admin anamnese route**
   - Keep current display strings (`Masculino`/`Feminino`) with nullable fallback, or switch to enum (`MASCULINO`/`FEMININO`)?
   - Recommendation: Keep existing display strings plus `null` to avoid unnecessary UI changes in this phase.

3. **Adjacent payload key cleanup**
   - Should `src/components/admin/member-actions.tsx` be updated to prefer `result.message` over `result.error` in failure toasts?
   - Recommendation: Treat as optional adjacent fix unless user wants strict phase scope.

## Sources

### Primary (HIGH confidence)
- Requirements and phase scope:
  - `.planning/REQUIREMENTS.md`
  - `.planning/ROADMAP.md`
- Revalidation bug location:
  - `src/app/actions/membros.ts`
- Anamnese heuristic locations:
  - `src/app/api/membros/[id]/anamnese/route.ts`
  - `src/app/api/anamnese-token/route.ts`
- Anamnese consumers:
  - `src/app/(admin)/alunos/[id]/anamnese/page.tsx`
  - `src/app/(auth)/anamnese/page.tsx`
- Dependency declarations and usage:
  - `package.json`
  - `src/__tests__/pdf/generation.test.ts`
  - `src/lib/pdf.ts`
- Existing tests to update/extend:
  - `src/__tests__/actions/membros.test.ts`
  - `src/__tests__/api/membros-id-anamnese.test.ts`
  - `src/__tests__/api/anamnese-token.test.ts`

### Secondary (MEDIUM confidence)
- `.planning/codebase/CONCERNS.md`
- `.planning/research/FEATURES.md`
- `.planning/research/PITFALLS.md`

### Tertiary (LOW confidence)
- None used.

## Metadata

**Confidence breakdown:**
- `BUG-01` scope and fix complexity: HIGH (directly verified in source and tests).
- `SEC-05` dependency classification: HIGH (verified imports and `package.json` state).
- `BUG-02` exact endpoint scope: MEDIUM (requirements text is broad; code has two heuristic endpoints).

**Research date:** 2026-02-16
**Valid until:** 2026-03-18
