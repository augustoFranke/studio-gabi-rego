# AGENTS.md — .github

CI and automation must keep main deployable.

---

## RULES

- Do not add flaky checks.
- Keep CI reasonably fast.
- Prisma/API changes must be covered by DB job.

---

## AFTER CHANGES

- Confirm required checks still pass.
- Confirm no secrets assumptions were introduced.
