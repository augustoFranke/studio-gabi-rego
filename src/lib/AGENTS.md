# AGENTS.md — src/lib

Shared utilities only.

---

## RULES

- Prefer pure functions.
- No single-use helpers.
- No hidden side effects.

---

## AFTER CHANGES

- If helper is only used once → inline it.
- If helper grows → split or simplify.
