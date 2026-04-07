# Vercel Production, Local Docker Validation

## Status
Observed

## Context
The project is deployed to Vercel in production and needs a reproducible local container path for smoke and integration testing.

## Decision
Treat Vercel as the only production deployment target:
- `vercel.json`
- `npm run vercel-build`

Keep Docker as a local-only validation path:
- `Dockerfile`
- `docker-compose.local.yml`

CI validates code quality and migration application against fresh Postgres. Local Docker is used for smoke testing, not for production parity or hosting.

## Alternatives Considered (Inferable)
- Vercel-only deployment target.
- Docker-only deployment target.
- Manual migration verification outside CI.

## Consequences
Pros:
- Single production contract and fewer runtime permutations.
- Reproducible local infra with containerized Postgres.
- Migration regressions caught early in CI DB job.

Cons:
- Docker no longer represents a supported production runtime.
- Local smoke behavior can still diverge from the Vercel runtime if the app depends on platform-specific features.

## Impacted Areas
- `vercel.json`
- `package.json` (`vercel-build` script)
- `Dockerfile`
- `docker-compose.local.yml`
- `.github/workflows/ci.yml`
- `docs/DEPLOYMENT.md`
- `docs/WORKFLOW.md`

## Evidence
Files:
- `vercel.json` (framework/build command/region)
- `package.json` (vercel-build pipeline)
- `Dockerfile`, `docker-compose.local.yml` (local smoke topology)
- `.github/workflows/ci.yml` (fast + DB jobs)

Commits:
- `f5bc767` - baseline deployment setup for Vercel + Supabase + Docker.
- `3274441` - local developer bootstrap improvements.
