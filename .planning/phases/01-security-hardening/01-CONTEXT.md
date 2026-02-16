# Phase 1: Security Hardening - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the current scoped security vulnerabilities in server action authorization, rate limiter production behavior, cron token validation, and password policy consistency.

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<specifics>
## Specific Ideas

No specific external references requested; use standard secure patterns aligned with existing project conventions.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-security-hardening*
*Context gathered: 2026-02-16*
