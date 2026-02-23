# Phase 1: Security Hardening - Research

**Researched:** 2026-02-16
**Domain:** Next.js API + Server Actions security hardening (authorization, rate-limit fail-closed, cron auth, password policy consistency)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
### Server action authorization behavior
- `toggleMembroStatus`, `deleteMembro`, and `deactivateMembro` are `ADMIN`-only.
- Unauthorized access returns a generic `Unauthorized` error message.
- Forbidden attempts are logged with verbose server context.
- Server action responses are standardized to a consistent `{ success, message }` shape.

### Rate limiter fail-closed policy
- In production, if Redis/Upstash is unavailable, protected endpoints fail closed.
- In development, if Redis/Upstash is unavailable, requests fail open with loud warning logs.
- Fail-closed responses return HTTP `429 Too Many Requests`.
- Fail-closed response body is standardized as `{ success: false, error: "Rate limit unavailable" }`.

### Cron secret validation behavior
- All cron routes use constant-time token comparison with `crypto.timingSafeEqual`.
- Missing or malformed cron tokens return `401 Unauthorized` with a generic message.
- Cron auth failures are logged with minimal structured warnings and no token leakage.
- Cron token validation is centralized in a shared helper to prevent drift.

### Password policy consistency + UX
- Canonical password rule: minimum 8 characters, at least 1 uppercase letter, and at least 1 number.
- Validation is enforced through a shared schema/util across registration and member update flows.
- Validation errors use a single generic message: "Password does not meet policy".
- Invalid password submissions reject the entire request (all-or-nothing behavior).

### Claude's Discretion
- Exact implementation shape for server-side logging helpers and log field naming.
- Placement and naming of shared cron validation helper and shared password validation utility.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

## Summary

This phase is tightly scoped and can be implemented with minimal architectural change by consolidating repeated security logic into shared helpers and then applying those helpers at the current boundaries (`src/app/actions`, `src/app/api`, `src/schemas`). The largest risk is drift: the same checks currently exist in multiple routes with slight differences (password validation messages, cron token checks, and rate-limit fallback behavior), so patching only one route will leave vulnerabilities open.

Current implementation has four clear gaps versus SEC-01..SEC-04: server actions in `src/app/actions/membros.ts` have no session/role guard; `src/lib/rate-limit.ts` fails open in production when Redis is unavailable; cron routes compare token strings directly; and password policy differs between auth schemas and member update schema. Existing API auth wrapper (`withApiAuth`) and validation helper (`validateRequest`) are already stable patterns in this repo and should be reused rather than introducing a new auth framework.

**Primary recommendation:** Implement three shared utilities first (server-action admin guard + audit log, cron token validator, password policy schema), then apply them to all affected routes/actions in one pass with test updates in the same phase.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.1.1 | Route handlers + server actions | Existing runtime boundary for all affected code paths |
| next-auth | ^5.0.0-beta.30 | Session + role source (`auth()`) | Already used by `withApiAuth`; no new auth surface required |
| Zod | ^4.3.5 | Input and policy validation | Existing schema boundary pattern under `src/schemas/**` |
| Vitest | ^4.0.17 | Regression tests | Existing unit/API test harness for these files |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @upstash/ratelimit | ^2.0.7 | Rate limit decision | Existing limiter implementation in `src/lib/rate-limit.ts` |
| @upstash/redis | ^1.36.0 | Upstash Redis backend | Existing backend for rate limiter |
| Node `crypto` | Node runtime | Constant-time secret compare | Cron bearer-token verification helper |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shared helper modules | Inline checks in each route/action | Faster per-file edits, but high drift risk and inconsistent behavior |
| Reusing `auth()` directly in server actions | Wrapping server action auth into helper | Direct calls are simpler once, helper is safer for repeated usage and consistent response shape |
| Zod shared password schema | Regex checks in each route | Inline checks duplicate logic and diverge error messages |

**Installation:**
```bash
# No new dependencies required for this phase
```

## Architecture Patterns

### Recommended Project Structure
```text
src/
├── app/actions/membros.ts                 # ADMIN-only action guards + standardized responses
├── app/api/cron/**/route.ts               # call centralized cron token helper
├── lib/security/
│   ├── cron-auth.ts                       # token extraction + timingSafeEqual validation
│   └── server-action-auth.ts              # admin guard + structured forbidden logging
└── schemas/
    ├── password-policy.schema.ts          # canonical password schema + message
    ├── auth.schema.ts                     # reuse canonical policy
    └── membro.schema.ts                   # reuse canonical policy for update flow
```

### Pattern 1: Guard-Then-Execute for Server Actions
**What:** Run authentication/authorization check at top of each server action and return normalized failure result before touching Prisma.
**When to use:** Any mutation-capable server action used by admin UI.
**Example:**
```typescript
const authz = await requireAdminAction({
  action: 'toggleMembroStatus',
  resourceId: id,
})

if (!authz.success) {
  return { success: false, message: 'Unauthorized' }
}
```

### Pattern 2: Centralized Cron Token Validator
**What:** Extract bearer token, validate format, compare with secret using `timingSafeEqual`, return typed result for route.
**When to use:** Every `/api/cron/**` route.
**Example:**
```typescript
const authz = validateCronRequest(request, process.env.CRON_SECRET)
if (!authz.ok) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### Pattern 3: Shared Password Policy Schema
**What:** Define one canonical Zod schema and reuse it across registration and member update flows.
**When to use:** Any endpoint that sets or updates a user password.
**Example:**
```typescript
export const passwordPolicySchema = z
  .string()
  .min(8, 'Password does not meet policy')
  .regex(/[A-Z]/, 'Password does not meet policy')
  .regex(/[0-9]/, 'Password does not meet policy')
```

### Anti-Patterns to Avoid
- **Client-only authorization checks:** `src/components/admin/member-actions.tsx` cannot enforce security.
- **String equality for secrets:** `token !== secret` leaks timing information and duplicates code.
- **Partial password updates after validation error:** reject request before any DB write.
- **Mixed response keys in server actions (`error` vs `message`):** causes inconsistent client handling.

## Don’t Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API auth/session parser in each route | Manual cookie/token parsing | Existing `auth()` + `withApiAuth` patterns | Reduces auth bugs and keeps role semantics consistent |
| Password rules in multiple routes | Inline regex chains in each endpoint | Shared Zod password policy schema | Prevents policy drift and inconsistent errors |
| Cron token checks in every cron file | Per-route token extract/compare logic | Shared cron validation helper | Keeps comparison and logging behavior aligned |
| Rate-limit fallback branching per route | Route-level `if` trees around limiter config | Centralized behavior in `rateLimitByIp` | Enforces one production fail-closed contract |

**Key insight:** Most work is consistency hardening, not new capability. Centralizing logic is the security improvement.

## Common Pitfalls

### Pitfall 1: Server action rejects but still throws
**What goes wrong:** Action throws generic exception instead of returning `{ success, message }`, causing inconsistent UI behavior.
**Why it happens:** Existing actions mix `{ success, error }` and try/catch behavior.
**How to avoid:** Keep authorization failure as normal return path; reserve catch for unexpected errors only.
**Warning signs:** UI toasts show fallback error text unpredictably.

### Pitfall 2: Production fail-closed not actually enforced
**What goes wrong:** Limiter unavailable returns `success: true` and request continues in production.
**Why it happens:** Current code logs critical error but explicitly fails open.
**How to avoid:** Return deterministic failure object from `rateLimitByIp` when production + limiter unavailable.
**Warning signs:** 200 responses during Redis outage tests.

### Pitfall 3: `timingSafeEqual` misuse with unequal buffer lengths
**What goes wrong:** Throws or behaves incorrectly if buffers are not normalized to equal length.
**Why it happens:** Comparing raw strings directly or converting inconsistently.
**How to avoid:** Normalize to `Buffer.from(value, 'utf8')` and reject malformed/missing token before compare.
**Warning signs:** Runtime errors on malformed Authorization header.

### Pitfall 4: Password policy fixed in one schema only
**What goes wrong:** Registration rejects weak passwords but admin update accepts them (or vice versa).
**Why it happens:** `auth` and `membro` schemas currently define different password constraints.
**How to avoid:** Import one policy schema in both schema files/routes; keep one canonical message.
**Warning signs:** Tests for cadastro pass while member update still accepts short password.

## Code Examples

Verified project patterns from current codebase:

### API Role Enforcement Pattern
```typescript
return withApiAuth(async () => {
  // handler
}, { requiredRole: 'ADMIN' })
```
Source: `src/app/api/membros/route.ts`, `src/lib/api.ts`

### Request Boundary Validation Pattern
```typescript
const validation = await validateRequest(request, schema)
if ('error' in validation) return validation.error
```
Source: `src/lib/api.ts`, `src/app/api/membros/[id]/route.ts`

### Current Vulnerable Server Action Pattern (to replace)
```typescript
export async function deleteMembro(id: string) {
  // no session/role check
  await prisma.usuario.delete({ where: { id: membro.usuarioId } })
}
```
Source: `src/app/actions/membros.ts`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-route inline auth/validation logic | Shared thin wrappers in `src/lib/api.ts` | Already present | This phase should extend same standard to server actions and cron auth |
| Password checks duplicated in routes | Schema-centric validation under `src/schemas/**` | Already present in many endpoints | Phase should align auth + member flows to one policy schema |
| Best-effort rate limiting | Deterministic fail-closed in production | Required now (SEC-02) | Prevents bypass during infra outage |

**Deprecated/outdated in this codebase scope:**
- Inline cron secret equality checks in each route (`token !== secret`): replace with centralized constant-time helper.

## Open Questions

1. **Server action unauthorized transport semantics**
   - What we know: phase context requires generic "Unauthorized" message and `{ success, message }` shape.
   - What's unclear: whether planner should also enforce HTTP-like status in action payload.
   - Recommendation: keep payload-only contract for server actions in this phase; status codes remain API-route concern.

2. **Logging field names for forbidden attempts**
   - What we know: verbose context required for server actions; minimal structured logs required for cron auth failures.
   - What's unclear: canonical field names.
   - Recommendation: standardize now with stable keys (`event`, `action`, `actorId`, `actorRole`, `resourceId`, `path`, `reason`) in helper.

## Sources

### Primary (HIGH confidence)
- Repo code: `src/app/actions/membros.ts` (missing auth guard + response inconsistency)
- Repo code: `src/lib/rate-limit.ts` (production fail-open behavior)
- Repo code: `src/app/api/cron/cobrancas-whatsapp/route.ts` and `src/app/api/cron/tarefas-email/route.ts` (direct token comparison)
- Repo code: `src/schemas/auth.schema.ts` and `src/schemas/membro.schema.ts` (password policy drift)
- Repo code: `src/lib/api.ts` (existing auth/validation boundary patterns)
- Tests: `src/__tests__/actions/membros.test.ts`, `src/__tests__/api/cron-*.test.ts`, `src/__tests__/api/auth-cadastro.test.ts`, `src/__tests__/schemas/*.test.ts`
- Dependency versions: `package.json`

### Secondary (MEDIUM confidence)
- None used

### Tertiary (LOW confidence)
- None used

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions and usage are directly verified in `package.json` and current imports.
- Architecture: HIGH - patterns already implemented in neighboring code (`withApiAuth`, `validateRequest`, schema boundary).
- Pitfalls: HIGH - directly observed from existing vulnerable paths and tests.

**Research date:** 2026-02-16
**Valid until:** 2026-03-18
