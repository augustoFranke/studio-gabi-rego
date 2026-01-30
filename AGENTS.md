# AGENTS.md - Project-wide operational notes

## Findings (Prisma + Supabase + Vercel)

- Prisma uses both `DATABASE_URL` (runtime) and `DIRECT_URL` (migrations) as defined in `prisma/schema.prisma`.
- The repo's production template expects `DATABASE_URL` to use the transaction pooler (port 6543) with `pgbouncer=true`, and `DIRECT_URL` to use direct or session pooler (port 5432).
- The recent production error is an authentication failure for the `postgres` role, which most often indicates invalid/changed credentials rather than IPv4 issues.
- After syncing local -> Supabase, role passwords can drift; stale credentials in Vercel will fail immediately.

## Instructions and rules

- Keep production split: `DATABASE_URL` = transaction pooler (port 6543) with `pgbouncer=true`; `DIRECT_URL` = direct or session pooler (port 5432).
- For Supabase pooler connections, use the correct host/port and the pooler username format `postgres.<project-ref>`; include `sslmode=require`.
- For Prisma + transaction pooler, always add `pgbouncer=true` to avoid prepared-statement issues.
- Treat "Authentication failed" errors as credential mismatches first; IPv4/DNS issues usually show as connectivity errors (timeouts/unreachable).
- After any DB restore/sync, rotate the DB password and update Vercel env vars (Production + Preview), then redeploy.
- Do not commit secrets: `.env.production` stays untracked; keep `.env.production.example` updated to reflect the intended production split.
- Prefer `pg_dump` over `pg_dumpall` for data syncs to avoid overwriting role passwords.
