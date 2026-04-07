# DEPLOYMENT

## Production
- Vercel is the only production deployment target.
- Production builds use `npm run vercel-build`.
- Production runtime assumptions must match `vercel.json`, the app code, and CI.

## Local Validation
- Docker is limited to local smoke and integration testing.
- Use `docker-compose.local.yml` to bring up the app and a Postgres container locally.
- Do not depend on Docker for production hosting, scaling, or release management.

## Runtime Contract
- Public health checks use `/api/health`.
- Database connectivity is required for a healthy runtime.
- Prisma migrations must be compatible with the CI migration deploy check.

## Environment Variables
- `DATABASE_URL` for runtime queries.
- `DIRECT_URL` for migrations.
- `NEXTAUTH_SECRET` and `NEXTAUTH_URL` for auth.
- `CRON_SECRET` for protected cron endpoints.
- `APP_TIMEZONE` for date and schedule normalization.

## Operational Notes
- Keep `vercel.json` as the source of truth for production cron scheduling.
- Keep `docker-compose.local.yml` as the source of truth for local container smoke tests.
- Update this document when production hosting assumptions change.
