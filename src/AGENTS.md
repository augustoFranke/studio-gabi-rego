# Agent Instructions: /src

This folder contains the application code. Aim for **clear boundaries** and **minimal duplication**.

## Organization rules

- UI and routes live under `src/app/**` (Next.js App Router).
- Shared utilities belong in `src/lib/**`.
- Prefer introducing `src/domain/**` and/or `src/schemas/**` when consolidating types/schemas:
  - `src/domain/**`: shared TS types for domain concepts
  - `src/schemas/**`: Zod schemas used at boundaries (API + client validation)
- Do not create random `utils/` grab-bags. Create narrow modules with specific names.

## Type hygiene

- Avoid repeating inline interfaces/types across multiple pages/routes.
- Prefer `z.infer<typeof Schema>` for boundary types.
- Keep types close to their domain; do not create a single "all types" mega-file.

## Bloat control

- If you add a helper, it must be used in at least 2 places OR reduce net lines.
- Prefer removing options/configs that aren't used.

## Testing expectations

- For non-trivial logic, add/adjust Vitest tests.
- Prefer extracting pure functions into small modules that are easy to unit test.
