# Agent Instructions (Repository Root)

You are an AI coding agent working in this repo. Your primary goal is to keep the codebase **small, direct, consistent, and safe to deploy**.

## Non-negotiables

- **Preserve behavior** unless explicitly asked to change it.
- Prefer **deleting code** and **inlining pass-through layers** over introducing new abstractions.
- Do **not** add new dependencies unless explicitly requested.
- Keep diffs **small**. Target **<250 lines changed** per PR/task unless the change is purely mechanical (formatting/codemod).
- Output should be **a unified diff** when asked to implement changes.

## Project shape (high level)

- Next.js App Router UI + API routes in `src/app/**`
- Prisma schema/migrations in `prisma/**`
- Shared utilities in `src/lib/**` (includes PDF generation)
- Tests via Vitest; scripts in `package.json`

## Local commands (use these as the source of truth)

- Install: `npm ci`
- Dev: `npm run dev`
- Lint: `npm run lint`
- Tests: `npm run test:run` (or `npm run test`)
- Build: `npm run build`
- Prisma: `npx prisma generate`, migrations handled via `npx prisma migrate dev` (dev) / `npx prisma migrate deploy` (CI/prod)

## Refactor strategy (this repo is AI-generated; optimize for reduction)

When improving code quality, prioritize in this order:

1. Remove dead/unreachable/unused code
2. Remove duplication (types, helpers, request parsing)
3. Collapse unnecessary layers (wrapper services/handlers that just forward calls)
4. Standardize API boundary validation and response shape
5. Only then optimize performance hotspots (requires measurement)

## Style rules (bias toward smaller code)

- Prefer **functions** over classes.
- Prefer **early returns** over nested conditionals.
- Use **simple data shapes**; avoid generic over-engineering.
- Avoid "one-off abstractions" (helpers used once).
- Keep modules focused: **one responsibility** per file.
- Avoid new global patterns unless they reduce total complexity.

## API rules (applies repo-wide)

- Inputs must be validated (Zod `safeParse`) at the boundary.
- Errors must be consistent and minimal; avoid repetitive try/catch wrappers.
- Do not invent new response shapes. Reuse existing patterns or create one small shared helper if needed.

## Prisma rules

- If `prisma/schema.prisma` changes, commit a migration (`prisma/migrations/**`).
- Never edit existing migrations to “make it work”; create a new migration.
- Avoid breaking changes without a clear plan (backfill + deploy sequencing).

## Performance rules

- Do not "optimize" without evidence.
- If asked to improve responsiveness, request or use:
  - API latency p95
  - build size / bundle concerns
  - DB query count
  - PDF generation timing
    Then make a **single targeted change**.

## Working mode

- Prefer **two-pass** workflow:
  1. Propose the smallest safe refactor options (ranked).
  2. Apply one option with a small diff.
- If uncertain, leave a TODO and do not guess behavior.

## Files with more specific rules

- `src/AGENTS.md`
- `src/app/AGENTS.md`
- `src/app/api/AGENTS.md`
- `src/lib/AGENTS.md`
- `prisma/AGENTS.md`
- `.github/AGENTS.md`
