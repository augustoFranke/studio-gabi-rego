# Deployment Monitoring Checklist - Gabi-Studio

**Production Domain:** https://gabi-studio-vibe-coded.vercel.app

This checklist provides a systematic approach for monitoring and troubleshooting deployment issues.

---

## Phase 1: Vercel Dashboard Check

### 1.1 Access Vercel Dashboard

- [ ] Navigate to [vercel.com/dashboard](https://vercel.com/dashboard)
- [ ] Select the **gabi-studio** project
- [ ] Note the current deployment status (Ready/Error/Building)

### 1.2 Review Deployment Logs

- [ ] Click on the latest deployment
- [ ] Check **Build Logs** for:
  - [ ] Prisma generate errors
  - [ ] Migration failures (`prisma migrate deploy`)
  - [ ] Next.js build errors
  - [ ] Missing environment variables

- [ ] Check **Runtime Logs** (Functions tab) for:
  - [ ] API route errors (500s)
  - [ ] Database connection failures
  - [ ] Authentication issues

### 1.3 Check Function Metrics

- [ ] Go to **Analytics** > **Functions**
- [ ] Look for:
  - [ ] High error rates (> 1%)
  - [ ] Slow response times (> 3s average)
  - [ ] Cold start issues

---

## Phase 2: Health Check Endpoints

### 2.1 API Health Check

Test the health endpoint:

```bash
curl -s https://gabi-studio-vibe-coded.vercel.app/api/health | jq
```

**Expected healthy response:**

```json
{
  "status": "healthy",
  "timestamp": "2026-01-13T00:00:00.000Z",
  "services": {
    "database": "connected",
    "app": "running"
  }
}
```

**Unhealthy response (HTTP 503):**

```json
{
  "status": "unhealthy",
  "timestamp": "2026-01-13T00:00:00.000Z",
  "services": {
    "database": "disconnected",
    "app": "running"
  },
  "error": "Error message here"
}
```

- [ ] Health endpoint returns 200 status
- [ ] Database shows "connected"
- [ ] App shows "running"

---

## Phase 3: Critical Route Testing

### 3.1 Authentication Flow

- [ ] Navigate to `/login`
- [ ] Verify login form renders
- [ ] Test login with valid credentials
- [ ] Verify redirect to appropriate dashboard

### 3.2 Admin Routes (requires admin login)

| Route | Check | Status |
|-------|-------|--------|
| `/dashboard` | Stats load, no API errors | [ ] |
| `/membros` | Member list loads from database | [ ] |
| `/agenda` | Schedule displays correctly | [ ] |
| `/financeiro` | Financial data renders | [ ] |
| `/treinos` | Training plans load | [ ] |

### 3.3 Member Routes (requires member login)

| Route | Check | Status |
|-------|-------|--------|
| `/meu-treino` | Training plan displays | [ ] |
| `/minha-agenda` | Schedule shows | [ ] |
| `/meus-dados` | Profile data loads | [ ] |

### 3.4 API Endpoints

Test critical APIs (requires authentication token):

```bash
# Health (no auth required)
curl -s https://gabi-studio-vibe-coded.vercel.app/api/health

# Members API
curl -s https://gabi-studio-vibe-coded.vercel.app/api/membros \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"

# Schedules API
curl -s https://gabi-studio-vibe-coded.vercel.app/api/agendamentos \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"

# Plans API
curl -s https://gabi-studio-vibe-coded.vercel.app/api/planos \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"

# Training API
curl -s https://gabi-studio-vibe-coded.vercel.app/api/treinos \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

---

## Phase 4: Error Investigation Flow

```
[Check Deployment]
        |
        v
[Deployment Status?]
   |         |
   v         v
[Error]   [Ready]
   |         |
   v         v
[Check     [Check /api/health]
Build          |
Logs]          v
   |      [Response?]
   v         /    |    \
[Prisma   Unhealthy  Healthy  Timeout
Error?]      |         |         |
   |         v         v         v
   v      [Database  [Check   [Cold
[Check    Connection  Runtime  Start
DATABASE  Issue]     Logs]    Issue]
_URL]         |
   |          v
   v      [Identify Failing Route]
[Next.js         |
Error?]          v
   |      [Check Browser Console]
   v              |
[Review           v
Recent    [Check Network Tab]
Commits]         |
                 v
            [Implement Fix]
```

### Quick Decision Tree

1. **Build Failed?** → Check build logs for Prisma/TypeScript errors
2. **Health Unhealthy?** → Database connection issue, check DATABASE_URL
3. **Health Timeout?** → Serverless cold start, may need to warm up
4. **Specific Route Fails?** → Check runtime logs for that function
5. **Frontend Error?** → Check browser console and network tab

---

## Phase 5: Common Issues Checklist

### Environment Variables

Required in Vercel:

- [ ] `DATABASE_URL` - Postgres connection string
- [ ] `NEXTAUTH_SECRET` - Auth secret (32+ chars)
- [ ] `NEXTAUTH_URL` - `https://gabi-studio-vibe-coded.vercel.app`

### Database Issues

- [ ] Check Supabase/Postgres dashboard for connection limits
- [ ] Verify migrations are up to date (`prisma migrate deploy`)
- [ ] Check for connection pool exhaustion
- [ ] Verify DATABASE_URL uses connection pooling for serverless

### Build Issues

- [ ] `prisma generate` runs before build (check package.json scripts)
- [ ] All dependencies listed in package.json
- [ ] No TypeScript errors in strict mode
- [ ] No missing imports or exports

### Authentication Issues

- [ ] NEXTAUTH_SECRET is set and consistent
- [ ] NEXTAUTH_URL matches the actual domain
- [ ] Session cookies are being set correctly
- [ ] OAuth providers (if any) have correct callback URLs

---

## Phase 6: Browser-Based Testing

Using browser dev tools:

1. [ ] Open **Network** tab before loading page
2. [ ] Filter by **Fetch/XHR** to see API calls
3. [ ] Check **Console** for JavaScript errors
4. [ ] Look for failed requests (red) in network tab
5. [ ] Check response bodies for error messages
6. [ ] Verify no CORS errors in console

### Common Browser Errors

| Error | Likely Cause |
|-------|--------------|
| `500 Internal Server Error` | Server-side exception, check runtime logs |
| `401 Unauthorized` | Session expired or invalid token |
| `403 Forbidden` | User lacks permission for resource |
| `404 Not Found` | Route doesn't exist or wrong URL |
| `CORS error` | API not configured for cross-origin |
| `Network Error` | Server unreachable or timeout |

---

## Quick Reference Commands

```bash
# Check recent Vercel deployments
vercel ls

# View deployment logs (live)
vercel logs https://gabi-studio-vibe-coded.vercel.app

# Check environment variables
vercel env ls

# Trigger new production deployment
vercel --prod

# Promote a preview deployment to production
vercel promote [DEPLOYMENT_URL]

# Rollback to previous deployment
vercel rollback

# Check Prisma migration status
npx prisma migrate status

# Run Prisma migrations
npx prisma migrate deploy
```

---

## When to Escalate

Escalate immediately if:

- [ ] Database is completely unreachable for > 5 minutes
- [ ] Auth provider (NextAuth) is misconfigured and blocking all logins
- [ ] Build fails consistently after 3+ attempts with same error
- [ ] Production data appears corrupted or missing
- [ ] Security incident suspected (unauthorized access, data breach)

### Escalation Contacts

| Issue Type | Contact |
|------------|---------|
| Database/Supabase | Supabase support dashboard |
| Vercel Platform | Vercel support or status.vercel.com |
| Application Bug | Development team |

---

## Monitoring Schedule

| Check | Frequency |
|-------|-----------|
| Health endpoint | After every deployment |
| Full route testing | Weekly or after major changes |
| Vercel dashboard review | Daily during active development |
| Error log review | Daily |

---

## Automated Monitoring

For automated checks, use the script at `scripts/check-deployment.sh`:

```bash
./scripts/check-deployment.sh
```

This script will:
- Check the health endpoint
- Verify critical routes are responding
- Report response times
- Alert on any failures
