# Database Connectivity Split

## Status
Observed

## Context
Prisma runtime queries and schema migrations have different connection behavior needs in Supabase/pooled environments.

## Decision
Adopt PostgreSQL via Prisma with dual URLs:
- `DATABASE_URL` for runtime traffic
- `DIRECT_URL` for migration/deploy traffic

Production templates prescribe Supabase pooler split (`6543` runtime with `pgbouncer=true`, `5432` direct/session for migrations).

## Alternatives Considered (Inferable)
- Single connection URL for both runtime and migrations.
- Non-Prisma migration layer.
- Direct DB-only connections without pooler split.

## Consequences
Pros:
- Reduces prepared-statement/pooler friction for runtime.
- Keeps migration channel explicit and controllable.

Cons:
- Operational complexity increases (two env vars must stay in sync).
- Credential drift incidents can break deploys if one URL is stale.

## Impacted Areas
- `prisma/schema.prisma`
- `.env.example`
- `.env.production.example`
- `AGENTS.md`
- CI and deploy scripts invoking Prisma migrate

## Evidence
Files:
- `prisma/schema.prisma` (`url` + `directUrl` datasource config)
- `.env.example`, `.env.production.example` (pooler split guidance)
- `AGENTS.md` (operational notes and constraints)
- `.github/workflows/ci.yml` (migration deploy validation)

Commits:
- `f5bc767` - deployment baseline including Vercel/Supabase setup.
- `70fb9fe` - schema/migration evolution for audited payment imports.
