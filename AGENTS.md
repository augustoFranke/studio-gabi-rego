# AGENTS.md — General Guidance for AI Coding Agents

Codex reads this file before doing any work. Keep instructions practical, testable, and oriented toward producing reviewable diffs. (This file may be layered with other AGENTS.md files along the directory path; closer instructions override broader ones.)

## Role
You are a coding agent working in this repo. Your job is to deliver correct, maintainable changes with minimal risk and minimal unnecessary scope. The primary goal is to keep the codebase **small, direct, consistent, and safe to deploy**.

## Core Working Agreements (Non-negotiables)

### 1) Correctness first, then elegance, then performance
- Prefer a *naively correct* solution first.
- If performance matters, optimize only after correctness is established (ideally with tests/benchmarks).
- **Do not optimize without evidence** (e.g., measure API latency, build size, DB query count).

### 2) Do not assume; manage uncertainty explicitly
- Before coding, identify assumptions you’re about to make.
- If an assumption is likely to be wrong or costly, ask a clarifying question or investigate the codebase to confirm.
- If requirements conflict or are underspecified, surface the inconsistency and propose options.

### 3) Avoid overengineering and abstraction bloat
- Default to the simplest design that fits the existing architecture.
- **Prefer deleting code** and **inlining pass-through layers** over introducing new abstractions.
- Do not introduce new patterns, layers, or frameworks unless they clearly reduce complexity.
- Avoid "one-off abstractions" (helpers used once).

### 4) Keep diffs tight and reviewable
- Make the smallest change that satisfies the success criteria.
- Target **<250 lines changed** per PR/task unless the change is purely mechanical.
- Don’t refactor unrelated code “while you’re there.”
- Remove dead code you introduced.

### 5) Preserve behavior
- **Preserve behavior** unless explicitly asked to change it.
- Be willing to push back politely if a requested approach is risky or brittle.

## Default Workflow

### Step A — Understand and set success criteria
- Restate the goal in your own words.
- Define “done” in concrete terms (tests passing, expected behavior, acceptance criteria).

### Step B — Investigate before changing
- Locate relevant code and existing patterns.
- **Project Shape:**
  - Next.js App Router UI + API routes in `src/app/**`
  - Prisma schema/migrations in `prisma/**`
  - Shared utilities in `src/lib/**` (includes PDF generation)
  - Tests via Vitest
- Prefer adapting existing utilities over inventing new ones.
- Validate external assumptions by reading code/docs.

### Step C — Plan briefly, then implement
- Provide a short plan (3–7 bullets) when the change is non-trivial.
- **Refactor Strategy** (optimize for reduction):
  1. Remove dead/unreachable/unused code.
  2. Remove duplication.
  3. Collapse unnecessary layers.
- Implement with minimal surface area and minimal new dependencies.

### Step D — Verify
- Add or update tests when feasible.
- **Local Commands (Source of Truth):**
  - Install: `npm ci`
  - Dev: `npm run dev`
  - Lint: `npm run lint`
  - Tests: `npm run test:run` (or `npm run test`)
  - Build: `npm run build`
  - Prisma: `npx prisma generate`, `npx prisma migrate dev` (dev) / `npx prisma migrate deploy` (CI/prod)
- If you cannot run commands, say what *should* be run and why.

### Step E — Report like a teammate
At the end, include:
- What changed (high-level)
- Where it changed (key files/modules)
- How it was verified (tests/commands)
- Known risks / follow-ups / TODOs
- Any assumptions made

## Coding Style & Standards

### General
- **Functions over classes.**
- **Early returns** over nested conditionals.
- **Simple data shapes**; avoid generic over-engineering.
- Comments should explain *why*, not restate *what*.
- Assume a human will review in an IDE: keep changes localized and preserve structure.

### API Rules
- Inputs must be validated (Zod `safeParse`) at the boundary.
- Errors must be consistent and minimal; avoid repetitive try/catch wrappers.
- Do not invent new response shapes; reuse existing patterns.

### Prisma Rules
- If `prisma/schema.prisma` changes, commit a migration.
- **Never edit existing migrations**; create a new migration.
- Avoid breaking changes without a clear plan.

### Dependency Policy
- **Do not add production dependencies** without explicit user approval.
- Prefer standard library and existing dependencies.

### Safety & Hygiene
- **Never** print, log, or exfiltrate secrets.
- Use placeholders for credentials and environment variables.
- Avoid touching security-sensitive areas unless required.

## Specific Sub-Agent Instructions
See these files for more specific rules:
- `src/AGENTS.md`
- `src/app/AGENTS.md`
- `src/app/api/AGENTS.md`
- `src/lib/AGENTS.md`
- `prisma/AGENTS.md`
- `.github/AGENTS.md`