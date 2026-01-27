# Agent Instructions: /src/app/api (API Routes)

API routes must be **thin**, **validated**, and **consistent**.

## Boundary validation (required)

- Validate request body/query/params at the route boundary using Zod `safeParse`.
- Return 400 with a minimal error payload when validation fails.
- Do not pass raw request data into Prisma calls without validation.

## Responses (required)

- Keep response shapes consistent across endpoints.
- Prefer a small shared helper (e.g., `ok()` / `fail()`) if multiple routes repeat the same structure.
- Avoid returning different shapes for success/failure unless already standardized.

## Authorization (required)

- Use the repo’s existing auth wrapper/pattern (e.g., `withApiAuth`) where applicable.
- Enforce access control close to the boundary; do not rely on the client for security.

## Prisma (required)

- Keep DB queries predictable and minimal.
- Prefer explicit `select` to avoid over-fetching when returning lists.
- Avoid N+1 query patterns; combine or prefetch if needed.

## Error handling

- Avoid over-wrapping errors. Use one try/catch at the top if necessary.
- Log enough context for debugging, but do not leak secrets/PII.

## Hot endpoints

- PDF generation endpoints (if any) are performance sensitive.
- Avoid synchronous heavy work in request handlers unless required.

## Change discipline

- Any change that affects response shape must be accompanied by updates where it’s consumed.
- Keep diffs small: refactor one route at a time.
