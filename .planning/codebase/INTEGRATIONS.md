# External Integrations

**Analysis Date:** 2026-02-11

## APIs & External Services

**Email Service:**
- Resend (resend.com)
  - What it's used for: Transactional emails (verification, password reset, notifications)
  - SDK/Client: HTTP API via fetch in `src/lib/resend.ts`
  - Auth: `RESEND_API_KEY` environment variable
  - Endpoints:
    - `https://api.resend.com/emails` (POST) - Send emails
  - Implemented at: `src/lib/resend.ts` (enviarEmail, emailTemplates)
  - Used by: `src/app/api/auth/*`, scheduler, cron jobs

**WhatsApp/Messaging:**
- Evolution API - Custom WhatsApp integration platform
  - What it's used for: WhatsApp message delivery for payment reminders and notifications
  - SDK/Client: HTTP API via fetch in `src/lib/whatsapp/evolution.ts`
  - Auth: `EVOLUTION_API_KEY` and `EVOLUTION_INSTANCE` environment variables
  - Configuration:
    - `EVOLUTION_API_URL` - Base URL for Evolution API
    - `EVOLUTION_INSTANCE` - Instance name (e.g., "studio")
    - `WHATSAPP_COUNTRY_CODE` - Country code for phone formatting (default: "55" for Brazil)
  - Functions:
    - `sendWhatsappText()` - Send text messages to WhatsApp contacts
    - `formatWhatsappNumber()` - Validate and format phone numbers
  - Used by: `src/lib/jobs/cobranca-whatsapp.ts`, cron job `src/app/api/cron/cobrancas-whatsapp/route.ts`
  - Health check: `isEvolutionConfigured()` verifies API credentials

**Rate Limiting Service:**
- Upstash Redis - Serverless Redis for rate limiting
  - What it's used for: API rate limiting (5 requests per minute)
  - SDK/Client: `@upstash/redis` and `@upstash/ratelimit` packages
  - Auth: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
  - Implementation: `src/lib/rate-limit.ts`
    - Sliding window algorithm: 5 requests per 1 minute
    - Per-IP tracking using `x-forwarded-for` header
    - Graceful degradation in test/development modes
  - Used by: API routes for authentication and sensitive endpoints

## Data Storage

**Databases:**
- PostgreSQL 16+ (Primary database)
  - Connection: `DATABASE_URL` (connection pooler for pooled connections)
  - Direct connection: `DIRECT_URL` (for Prisma migrations, bypasses pooler)
  - Client: Prisma ORM (`@prisma/client`, `prisma`)
  - Schema: `prisma/schema.prisma`
  - Models: Usuario, Membro, Pagamento, Agendamento, Horario, Notificacao, Anamnese
  - Hosting options:
    - Local: Docker container via `docker-compose.yml`
    - Production: Supabase PostgreSQL with pgbouncer connection pooling (port 6543)
  - RLS (Row-Level Security) configuration available in `prisma/rls_enable_public.sql`

**File Storage:**
- Local filesystem only
  - Font files: `public/fonts/FreeStyleScript.ttf` (for PDF generation)
  - Logo: `public/logo-black.png` (for PDF generation)
  - Configured in next.config.ts outputFileTracingIncludes for API routes
  - No cloud storage integration (S3, GCS, etc.)

**Caching:**
- Upstash Redis (as above) - Used for rate limiting and potential data caching
- No in-memory cache layer (e.g., Redis local) configured
- Server-side caching via Next.js (fetch cache directives in Server Components)

## Authentication & Identity

**Auth Provider:**
- NextAuth.js 5.0.0-beta.30 (Custom implementation)
  - Implementation approach:
    - Credentials provider (email + password)
    - JWT session strategy with 24-hour max age
    - Prisma adapter for session management
    - Custom bcryptjs password hashing
  - Configured at: `src/lib/auth.ts`
  - API endpoint: `src/app/api/auth/[...nextauth]/route.ts`
  - JWT secret: `NEXTAUTH_SECRET` environment variable
  - Security features:
    - Constant-time password comparison
    - Email verification required before login
    - Password reset flow with token expiration
    - Role-based access control (ADMIN, MEMBRO)
  - Middleware protection: `src/middleware.ts` validates JWT tokens

**User Roles:**
- ADMIN - Administrative access
- MEMBRO - Member/student access

## Monitoring & Observability

**Error Tracking:**
- Not detected - No Sentry, Rollbar, or similar configured

**Logs:**
- Console-based logging
  - Development: logs queries, errors, warnings
  - Production: errors only
  - Configured via `src/lib/prisma.ts` Prisma client initialization

**Health Checks:**
- Endpoint: `src/app/api/health/route.ts`
- Used by: Docker healthcheck and Kubernetes probes
- Verifies: Basic app connectivity

## CI/CD & Deployment

**Hosting:**
- **Primary (Production):** Vercel (Next.js optimized platform)
  - Auto-image optimization enabled
  - Environment variables via Vercel Dashboard
  - Git integration for continuous deployment
- **Secondary (Docker):** Self-hosted Docker deployment
  - Docker image: `node:20-alpine`
  - Docker Compose orchestration in `docker-compose.yml`
  - PostgreSQL service included
  - Health checks configured (wget to /api/health)

**CI Pipeline:**
- GitHub Actions (repository indicators suggest GitHub integration)
- Pre-commit hooks via Husky
  - npm run pre-commit (runs tests)
  - Prevents commits with failing tests

**Database Migrations:**
- Prisma migrate
  - Development: `npx prisma migrate dev`
  - Production (Vercel): Automatic via `vercel-build` script
  - Production (Docker): Manual via `npm run db:migrate:deploy`
  - Direct URL used to bypass connection pooler for migrations

## Environment Configuration

**Required env vars (Production):**
```
# Database
DATABASE_URL (with pgbouncer=true for Supabase)
DIRECT_URL (direct connection for migrations)

# Authentication
NEXTAUTH_SECRET (32+ bytes, base64)
NEXTAUTH_URL (https://studiogabirego.com)
NEXT_PUBLIC_APP_URL (https://studiogabirego.com)
CORS_ALLOWED_ORIGIN

# Email
RESEND_API_KEY (re_*)

# WhatsApp
EVOLUTION_API_URL
EVOLUTION_API_KEY
EVOLUTION_INSTANCE
WHATSAPP_COUNTRY_CODE

# Rate Limiting
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN

# Scheduling
APP_TIMEZONE (America/Sao_Paulo)
CRON_SECRET
```

**Secrets location:**
- `.env` (local development, git-ignored)
- `.env.production` (production secrets, git-ignored)
- Vercel Dashboard for production deployments
- Docker: passed via docker-compose environment section

## Webhooks & Callbacks

**Incoming:**
- Cron job endpoints (internal use only):
  - `POST /api/cron/cobrancas-whatsapp` - Payment reminders via WhatsApp
  - `POST /api/cron/tarefas-email` - Email tasks (location: `src/app/api/cron/tarefas-email/`)
  - Protected by `CRON_SECRET` header validation
- No external webhook integrations from Stripe, GitHub, etc.

**Outgoing:**
- Email callbacks: Resend async delivery (no callback URL configured)
- WhatsApp callbacks: Evolution API may support webhooks (not configured in codebase)
- No Slack, Discord, or other notification service integrations

## API Integration Patterns

**Rate Limiting Implementation:**
- Location: `src/lib/rate-limit.ts`
- Applied to: Authentication endpoints (`/api/auth/*`)
- Pattern: IP-based sliding window (5 req/min)
- Graceful failure: Allows requests if Redis unavailable in production (logs critical warning)

**Email Template System:**
- Location: `src/lib/resend.ts` (emailTemplates object)
- HTML + text fallback generation
- XSS protection via HTML sanitization (dompurify)
- Used for: Email verification, password reset, notifications

**PDF Generation Pipeline:**
- Libraries: pdfkit (Node.js) + pdf-lib (universal)
- Endpoints: `POST /api/treinos/gerar-pdf`, `GET /api/treinos/[id]/pdf`
- Resources: Font files and logo statically included in Docker image
- Configuration: outputFileTracingIncludes in next.config.ts for file access

---

*Integration audit: 2026-02-11*
