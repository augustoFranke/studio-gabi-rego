# Phase 3: Data Integrity - Research

**Researched:** 2026-02-20
**Domain:** Canonical anamnese normalization and nullable-member-email integrity hardening
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
### Canonical Anamnese Field Behavior
- New canonical anamnese fields must auto-propagate everywhere.
- Unknown anamnese keys in payloads should be ignored silently.
- Missing known anamnese fields should default to `null`.
- When a canonical field is removed, legacy values should be migrated/cleaned up in this phase.

### Email-Missing Behavior (No Placeholder Strategy)
- Do not use placeholder email generation. If there is no email, it remains missing (`null`).
- Existing placeholder emails should be migrated to `null` in this phase.
- Member create/update should accept missing email (`null`) as valid.
- Email-dependent flows should be blocked until email is provided.

### Legacy/Inconsistent Data Handling
- Read APIs should auto-normalize malformed legacy anamnese data to canonical shape.
- Normalized data should be persisted back to DB (self-healing behavior).
- Placeholder-email migration should pre-validate all records and migrate only the safe set.
- Include a deterministic one-time migration script plus output/report artifact in this phase.

### Error and Fallback Behavior
- If normalization fails unexpectedly, fail request with clear integrity error.
- Migration execution should be transactional fail-fast (all-or-nothing).
- Post-phase payload validation should be tolerant on read/write with warnings.
- Client-facing error responses should remain generic (no technical internals).

### Claude's Discretion
- Naming and placement of migration/report artifacts in repository structure.
- Warning transport format details (log-only vs response metadata), as long as generic client error messaging is preserved.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

## Summary

Phase 3 is now broader than the original ROADMAP wording because `03-CONTEXT.md` locks a different decision for `DATA-02`: remove placeholder-email generation entirely and migrate to nullable emails. That requires Prisma schema migration, member route contract updates, and null-safe handling in email-sending flows.

`DATA-01` is localized and clear: `src/app/api/minha-anamnese/route.ts` still defines its own `ANAMNESE_FIELDS` and serializer while other routes already use `sanitizeAnamnesePayload`. Canonicalization should move fully into `src/lib/anamnese.ts` with read-time normalization utilities so legacy malformed records are auto-healed and persisted.

**Primary recommendation:** Plan Phase 3 as three plans: (1) canonical anamnese normalization + self-healing reads, (2) nullable email domain migration + API contract updates, (3) deterministic placeholder-email cleanup script with report artifact and fail-fast transactional execution.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js Route Handlers | 16.1.1 | API surface for anamnese/member flows | Existing route contract and auth wrappers are already established |
| Prisma Client + Migrate | ^6.19.1 | Schema + data integrity changes | Required for nullable `Usuario.email` and migration safety |
| Zod | ^4.3.5 | Input validation contracts | Existing member/anamnese route schemas already use Zod |
| Vitest | ^4.0.17 | Regression checks | Existing API-level tests already cover target routes |

### Supporting
| Library/API | Version | Purpose | When to Use |
|-------------|---------|---------|-------------|
| `tsx` utility scripts | ^4.21.0 | One-time deterministic migration runner | Placeholder-email cleanup with preview + report |
| Existing `normalizeEmail` helper | local | Null-safe display handling | Admin UI and profile rendering for nullable emails |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Nullable email migration | Keep placeholders centralized | Contradicts locked context decision, keeps polluted data |
| Read-time self-heal writes | Read-only normalization | Leaves DB drift unresolved and repeats normalization work |
| Deterministic script + report | Manual SQL in psql shell | Lower traceability and harder audit/replay behavior |

**Installation:**
```bash
# No new third-party dependency required for this phase.
```

## Architecture Patterns

### Recommended Project Structure
```text
src/
├── lib/
│   ├── anamnese.ts                  # canonical fields + sanitize/normalize helpers
│   └── email.ts                     # null-aware email helpers
├── app/api/
│   ├── minha-anamnese/route.ts      # use shared canonical helpers only
│   ├── anamnese-token/route.ts      # self-healing read path
│   ├── membros/route.ts             # create with nullable email
│   └── membros/[id]/route.ts        # update with nullable email
prisma/
├── schema.prisma                    # Usuario.email nullable
└── migrations/.../migration.sql     # nullable-email schema migration
utility/
└── migrate-placeholder-emails.ts    # deterministic one-time migration + report
```

### Pattern 1: Canonical Anamnese Normalization
**What:** Keep canonical anamnese field set in one module and expose helper(s) for sanitize + normalize.
**When to use:** Every anamnese POST/PUT read/write boundary.
**Example:**
```typescript
const normalized = normalizeAnamneseRecord(input)
const sanitized = sanitizeAnamnesePayload(body)
```

### Pattern 2: Self-Healing Read APIs
**What:** Normalize malformed legacy anamnese payload on read and persist canonical shape back to DB.
**When to use:** GET handlers that load persisted anamnese data from legacy rows.
**Example:**
```typescript
if (normalization.changed) {
  await prisma.anamnese.update({ where: { membroId }, data: normalization.data })
}
```

### Pattern 3: Nullable Email Domain Model
**What:** Treat missing email as first-class `null`, never synthesize placeholder addresses.
**When to use:** Member create/update routes and downstream email-dependent flows.
**Example:**
```typescript
const normalizedEmail = normalizeEmail(inputEmail)
// persist null when absent
```

### Anti-Patterns to Avoid
- Duplicating `ANAMNESE_FIELDS` or serializer logic in route files.
- Rejecting payloads solely because unknown keys exist (must ignore unknown keys now).
- Continuing to generate `@placeholder.local` values in any create/update path.
- Running one-time data migration without preview/safe-set checks and artifact report.

## Don’t Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Canonical payload filtering | Route-local field arrays | Shared helpers in `src/lib/anamnese.ts` | Prevents drift between endpoints |
| Email missing-state workaround | Random placeholder email strings | Nullable `Usuario.email` + helper guards | Avoids polluted user identity data |
| Migration observability | Ad hoc console-only script | Deterministic script + JSON report artifact | Auditable and reproducible |

**Key insight:** Integrity improvements must be both structural (single source of truth) and historical (legacy cleanup), otherwise drift reappears immediately.

## Common Pitfalls

### Pitfall 1: Nullable Prisma field ripple ignored
**What goes wrong:** Type errors or runtime assumptions break where `usuario.email` was treated as always string.
**Why it happens:** Prisma type change propagates broadly.
**How to avoid:** Include `npm run typecheck` in verification and patch all email-dependent logic.
**Warning signs:** `string | null` assignment errors and `toLowerCase` on nullable values.

### Pitfall 2: Silent behavior mismatch between context and roadmap text
**What goes wrong:** Plans still centralize placeholder generator instead of removing placeholders.
**Why it happens:** ROADMAP currently says "single placeholder function."
**How to avoid:** Treat `03-CONTEXT.md` decisions as locked source of truth for planning.
**Warning signs:** Any task proposing `generatePlaceholderEmail()`.

### Pitfall 3: Self-healing writes create noisy updates
**What goes wrong:** Every GET attempts updates even when no data changed.
**Why it happens:** Missing diff check before persistence.
**How to avoid:** Persist only when normalization detects concrete changes.
**Warning signs:** Update queries executed on every GET regardless of data state.

## Code Examples

Current hotspots verified in repo:

```typescript
// src/app/api/minha-anamnese/route.ts
const ANAMNESE_FIELDS = [ ... ] // duplicated canonical list (must be removed)
```

```typescript
// src/app/api/membros/route.ts
email: normalizedEmail || `temp_${Date.now()}@placeholder.local`
```

```typescript
// src/app/api/membros/[id]/route.ts
const normalizedEmail = shouldClearEmail
  ? `temp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}@placeholder.local`
  : ...
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Route-local anamnese field lists | Shared canonical normalization helper | Phase 3 target | Single-source integrity |
| Placeholder fallback emails | Nullable email with guarded flows | Phase 3 target | Cleaner identity data, less drift |
| Manual migration notes | Deterministic script + report artifact | Phase 3 target | Auditable and repeatable cleanup |

**Deprecated/outdated in this phase:**
- Any `temp_*@placeholder.local` generation in API routes.
- Any route-local `ANAMNESE_FIELDS` definition outside `src/lib/anamnese.ts`.

## Open Questions

1. **Where should migration reports live long-term?**
   - What we know: Context allows discretion for artifact placement.
   - Recommendation: Use `utility/logs/` JSON artifacts with deterministic naming.

2. **How visible should anamnese normalization warnings be?**
   - What we know: Client responses must remain generic.
   - Recommendation: Emit server logs only (or internal metadata not exposed to users).

## Sources

### Primary (HIGH confidence)
- `.planning/phases/03-data-integrity/03-CONTEXT.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `src/lib/anamnese.ts`
- `src/app/api/minha-anamnese/route.ts`
- `src/app/api/membros/route.ts`
- `src/app/api/membros/[id]/route.ts`
- `src/app/api/membros/[id]/anamnese/route.ts`
- `src/app/api/anamnese-token/route.ts`
- `src/lib/email.ts`
- `prisma/schema.prisma`
- `src/__tests__/api/minha-anamnese.test.ts`
- `src/__tests__/api/membros-id-anamnese.test.ts`
- `src/__tests__/api/membros.test.ts`
- `src/__tests__/api/membros-id.test.ts`

### Secondary (MEDIUM confidence)
- `.planning/codebase/CONCERNS.md`
- `.planning/research/FEATURES.md`
- `utility/cleanup-inactive-members.ts` (script/report pattern reference)

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Canonical anamnese consolidation scope: HIGH (direct source verification).
- Nullable email migration impact surface: HIGH (source + schema + test evidence).
- Self-healing warning transport choice: MEDIUM (implementation discretion).

**Research date:** 2026-02-20
**Valid until:** 2026-03-22
