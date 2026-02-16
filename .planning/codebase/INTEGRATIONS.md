# External Integrations

**Analysis Date:** 2026-02-16

## APIs & External Services

**Email (Resend):**
- Service: Resend - Transactional email delivery
- SDK/Client: Direct REST API via `fetch` (no SDK package)
  - Implementation: `src/lib/resend.ts`
  - Endpoint: `https://api.resend.com/emails`
  - Auth: Bearer token from `RESEND_API_KEY`
  - From address: `Studio Gabi Rego <suporte@studiogabirego.com>`
  - Reply-to: `suporte@studiogabirego.com`
- Feature detection: `isResendConfigured()` returns false if env var missing (graceful degradation)
- Email templates (inline HTML): `src/lib/resend.ts` > `emailTemplates`
  - `lembreteAula` - Class reminder
  - `cobranca` - Payment reminder
  - `verificacaoEmail` - Email verification
  - `completarPerfil` - Profile completion link
  - `redefinirSenha` - Password reset
  - `aniversario` - Birthday greeting
  - `boasVindas` - Welcome message
- All templates include XSS-safe HTML escaping via `escapeHtml()`
- Plain text fallback auto-generated from HTML via `buildTextFallback()`

**WhatsApp (Evolution API):**
- Service: Evolution API - Self-hosted WhatsApp gateway
- SDK/Client: Direct REST API via `fetch` (no SDK package)
  - Implementation: `src/lib/whatsapp/evolution.ts`
  - Endpoint: `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`
  - Auth: `apikey` header + Bearer token from `EVOLUTION_API_KEY`
- Configuration env vars:
  - `EVOLUTION_API_URL` - Base URL of Evolution API instance
  - `EVOLUTION_API_KEY` - API authentication key
  - `EVOLUTION_INSTANCE` - WhatsApp instance name (e.g., "studio")
  - `WHATSAPP_COUNTRY_CODE` - Default country code (default: "55" for Brazil)
- Feature detection: `isEvolutionConfigured()` checks all three env vars
- Phone formatting: `formatWhatsappNumber()` handles Brazilian phone formats (10-11 digits + country code)
- Used for:
  - Payment reminders (1 day before due): `src/lib/jobs/cobranca-whatsapp.ts`
  - Class reminders: `src/lib/scheduler.ts` > `processarLembretesAula()`
  - Birthday greetings: `src/lib/scheduler.ts` > `processarAniversarios()`

**Rate Limiting (Upstash Redis):**
- Service: Upstash - Serverless Redis
- SDK: `@upstash/redis` ^1.36.0, `@upstash/ratelimit` ^2.0.7
  - Implementation: `src/lib/rate-limit.ts`
  - Auth: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- Rate limit: Sliding window, 5 requests per 1 minute per IP
- Feature detection: Fails open if not configured (logs critical warning in production)
- Used in auth-related API routes for brute force protection

## Data Storage

**Database:**
- PostgreSQL 16
  - Production: Supabase PostgreSQL (sa-east-1 region)
    - Connection pooling via pgbouncer (port 6543, `?pgbouncer=true`)
    - Direct connection for migrations (port 5432)
  - Development: Local PostgreSQL via Docker Compose (`postgres:16-alpine`)
  - Connection: `DATABASE_URL` (pooled), `DIRECT_URL` (direct for migrations)
  - Client: Prisma ORM ^6.19.1
    - Schema: `prisma/schema.prisma`
    - Client singleton: `src/lib/prisma.ts` (global singleton pattern for dev hot-reload)
    - Logging: `['query', 'error', 'warn']` in dev, `['error']` in production
  - Migrations: `prisma/migrations/` (6 migrations total)
  - Seed: `prisma/seed.ts`
  - Row-Level Security: `prisma/rls_enable_public.sql` (Supabase-specific)

**Database Models (14 total):**
- `Usuario` - Users (auth, role: ADMIN/MEMBRO)
- `Membro` - Member profiles (linked to Usuario)
- `Plano` - Subscription plans
- `HorarioDisponivel` - Available time slots
- `Agendamento` - Bookings/appointments
- `HorarioFixo` - Fixed recurring schedules per member
- `Pagamento` - Payments
- `FichaTreino` - Workout sheets
- `Exercicio` - Exercises within workout sheets
- `TreinoTemplate` - Workout templates
- `TreinoTemplateExercicio` - Template exercises
- `Notificacao` - Notifications (email + WhatsApp)
- `Anamnese` - Health assessment questionnaire
- `Configuracao` - System key-value configuration

**File Storage:**
- Local filesystem only (no cloud storage)
- PDF generation output served directly as response (not persisted)
- Custom font embedded as base64 in `src/lib/fonts/FreeStyleScript.base64.ts`
- Static assets in `public/` (logo, fonts)

**Caching:**
- Upstash Redis for rate limiting only (no application-level caching)
- SWR for client-side data caching (`src/lib/fetcher.ts`)
- React `cache()` wraps `auth()` for request-level deduplication (`src/lib/auth.ts`)

## Authentication & Identity

**Auth Provider:**
- NextAuth.js v5 (beta.30) - Custom credentials-based authentication
  - Implementation: `src/lib/auth.ts`
  - Route handler: `src/app/api/auth/[...nextauth]/route.ts`
  - Strategy: JWT (24h session max age)
  - Provider: Credentials only (email + password)
  - Password hashing: bcryptjs
  - Custom login page: `/login`

**Auth Flow:**
1. Registration: `POST /api/auth/cadastro` - Creates user with hashed password, sends verification email
2. Email verification: `GET /api/auth/verificar-email?token=...` - Validates token, marks email verified
3. Re-send verification: `POST /api/auth/reenviar-verificacao`
4. Login: NextAuth Credentials provider (`src/lib/auth.ts`)
5. Password reset: `POST /api/auth/enviar-reset-senha` + `POST /api/auth/redefinir-senha`
6. Token validation: `POST /api/auth/validar-token-reset`

**Authorization:**
- Middleware-based route protection: `src/middleware.ts`
  - Admin routes: `/dashboard`, `/alunos`, `/treinos`, `/financeiro`, `/agenda`, `/configuracoes`
  - Member routes: `/inicio`, `/minha-agenda`, `/meu-treino`, `/pagamentos`, `/meu-perfil`
  - Public routes: `/login`, `/cadastro`, `/verificar-email`, `/anamnese`, `/completar-perfil`, etc.
- API-level: `withApiAuth()` helper in `src/lib/api.ts` with role checking
- Owner checks: `ensureOwnerOrAdmin()` for resource-level authorization

**JWT Token Contents:**
- `id` - User ID
- `role` - "ADMIN" or "MEMBRO"
- `membroId` - Member profile ID (if role is MEMBRO)

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, etc.)
- Console-based error logging only

**Logs:**
- `console.log` / `console.error` / `console.warn` throughout
- Prisma query logging in development mode
- Structured shutdown logging in `src/lib/shutdown.ts`

**Health Check:**
- `GET /api/health` - Used by Docker health checks and monitoring

## CI/CD & Deployment

**Primary Hosting: Vercel**
- Config: `vercel.json`
- Region: `gru1` (Guarulhos/Sao Paulo, Brazil)
- Framework: Next.js (auto-detected)
- Build command: `npm run vercel-build` (generates Prisma, runs migrations conditionally, runs tests, builds Next.js)
- Conditional migrations via `RUN_MIGRATIONS=1` env var

**Alternative Hosting: Docker**
- Multi-stage Dockerfile (`Dockerfile`)
- Docker Compose (`docker-compose.yml`) with PostgreSQL 16
- Standalone Next.js output
- Non-root user (`nextjs:nodejs`) for security
- Health check: `wget` to `/api/health` every 30s
- Backup script: `docker/scripts/backup.sh`

**CI Pipeline:**
- No dedicated CI service (GitHub Actions, etc.)
- Pre-commit hook runs tests via Husky
- Vercel build includes test execution (`npm run test:run`)

## Cron Jobs / Scheduled Tasks

**Email Tasks:**
- Endpoint: `POST /api/cron/tarefas-email`
  - Auth: Bearer token matching `CRON_SECRET`
  - Implementation: `src/lib/scheduler.ts` > `executarTodasTarefas()`
  - Tasks: class reminders, payment reminders, birthday greetings, overdue payment status updates, recurring appointment sync

**WhatsApp Payment Reminders:**
- Endpoint: `POST /api/cron/cobrancas-whatsapp`
  - Auth: Bearer token matching `CRON_SECRET`
  - Implementation: `src/lib/jobs/cobranca-whatsapp.ts` > `runCobrancaWhatsappT1()`
  - Sends reminders 1 day before payment due date

**Trigger:** External cron service (e.g., Vercel Cron Jobs, Upstash QStash, or manual) calls these endpoints with Bearer token

## Webhooks & Callbacks

**Incoming:**
- Cron endpoints act as webhook-like receivers (see above)
- Anamnesis token endpoint: `POST /api/anamnese-token` (public, token-based access for member health questionnaire)

**Outgoing:**
- None (all external communication is push-based via direct API calls to Resend and Evolution API)

## Environment Configuration

**Required env vars (production):**
- `DATABASE_URL` - PostgreSQL connection (pooled)
- `DIRECT_URL` - PostgreSQL direct connection (migrations)
- `NEXTAUTH_SECRET` - JWT signing secret
- `NEXTAUTH_URL` - Auth callback base URL
- `NEXT_PUBLIC_APP_URL` - Public-facing base URL for email links
- `CRON_SECRET` - Cron endpoint auth token

**Optional env vars (graceful degradation):**
- `RESEND_API_KEY` - Email disabled if missing
- `EVOLUTION_API_URL` + `EVOLUTION_API_KEY` + `EVOLUTION_INSTANCE` - WhatsApp disabled if missing
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` - Rate limiting disabled if missing (fails open with warning)
- `CORS_ALLOWED_ORIGIN` - Defaults to `NEXTAUTH_URL`
- `APP_TIMEZONE` - Defaults to `America/Sao_Paulo`
- `WHATSAPP_COUNTRY_CODE` - Defaults to `55`

**Secrets location:**
- Vercel Dashboard > Settings > Environment Variables (production)
- `.env` / `.env.development` / `.env.production` files (local, gitignored)

## PDF Generation

**Workout PDF:**
- Library: pdfkit ^0.17.2
- Implementation: `src/lib/pdf.ts` > `generateTrainingPDF()`
- API routes:
  - `POST /api/treinos/gerar-pdf` - Generate PDF for workout
  - `GET /api/treinos/[id]/pdf` - Get PDF for specific workout
- Output: A4 format, custom branding (logo + FreeStyleScript font)
- Font embedding: Base64-encoded TTF for serverless compatibility
- File tracing configured in `next.config.ts` > `outputFileTracingIncludes` for Vercel deployment

---

*Integration audit: 2026-02-16*
