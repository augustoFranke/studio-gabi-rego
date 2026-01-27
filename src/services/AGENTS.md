# AGENTS.md — src/services

Services contain business logic and Prisma access.

---

## BEFORE WRITING CODE

- Confirm input types come from `src/schemas/**`.
- Confirm outputs align with `src/domain/**`.

---

## SERVICE RULES

- No HTTP, no cookies, no headers.
- No Zod parsing here.
- Keep functions small and focused.
- Prefer explicit Prisma `select` fields.

---

## AFTER CHANGES

- If logic is used once → inline or delete abstraction.
- If new domain concept appears → update `src/domain/**`.
