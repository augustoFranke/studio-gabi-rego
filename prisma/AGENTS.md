# AGENTS.md — prisma

Database schema and migrations.

---

## STRICT RULES

- Any schema change requires a migration.
- Never edit existing migration SQL.
- Prefer additive, backward-compatible changes.

---

## AFTER CHANGES

- Ensure migrations apply cleanly to empty DB.
- Ensure CI DB job will pass.
