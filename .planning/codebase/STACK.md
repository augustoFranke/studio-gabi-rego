# Technology Stack

**Analysis Date:** 2026-02-16

## Languages

**Primary:**
- TypeScript ^5 - All application code (source, config, tests, utility scripts)

**Secondary:**
- SQL - Prisma migrations (`prisma/migrations/`)
- Bash - Docker and deployment scripts (`docker/scripts/`, `scripts/`)

## Runtime

**Environment:**
- Node.js (Dockerfile pins `node:20-alpine`; local machine runs v25.6.1)
- No `.nvmrc` or `.node-version` file present

**Package Manager:**
- npm 11.9.0
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 16.1.1 - Full-stack React framework (App Router)
  - Config: `next.config.ts`
  - React 19.2.3 / React DOM 19.2.3
  - Server Actions enabled (2MB body limit)
  - Standalone output for Docker; default for Vercel

**UI Component System:**
- shadcn/ui (new-york style) - Component primitives
  - Config: `components.json`
  - CSS variables enabled, base color: neutral
  - Icon library: lucide-react ^0.562.0
  - Components dir: `src/components/ui/`
- Radix UI primitives: avatar, dialog, dropdown-menu, label, popover, scroll-area, select, separator, slot, tabs, tooltip
- cmdk ^1.1.1 - Command palette component

**Styling:**
- Tailwind CSS ^4 (via PostCSS plugin `@tailwindcss/postcss`)
  - Config: `postcss.config.mjs`
  - CSS entry: `src/app/globals.css`
  - tw-animate-css ^1.4.0 for animations
- tailwind-merge ^3.4.0 - Class merging utility
- class-variance-authority ^0.7.1 - Variant management
- clsx ^2.1.1 - Conditional classnames

**Testing:**
- Vitest ^4.0.17 - Test runner
  - Config: `vitest.config.ts`
  - Environment: node
  - Globals: enabled
  - Setup: `src/__tests__/setup.ts`
- @vitest/coverage-v8 ^4.0.17 - Coverage provider
- Playwright ^1.57.0 - Listed as devDependency (E2E capability)

**Build/Dev:**
- TypeScript ^5 - Type checking
  - Config: `tsconfig.json` (target ES2017, strict mode)
  - Typecheck config: `tsconfig.typecheck.json`
- ESLint ^9 - Linting
  - Config: `eslint.config.mjs`
  - Extends: eslint-config-next (core-web-vitals + typescript)
- Husky ^9.1.7 - Git hooks
  - Pre-commit hook: runs `npm run test:run` (`.husky/pre-commit`)
- tsx ^4.21.0 - TypeScript execution for utility scripts

## Key Dependencies

**Critical (Runtime):**
- next-auth ^5.0.0-beta.30 - Authentication (JWT strategy, Credentials provider)
  - Adapter: @auth/prisma-adapter ^2.11.1
  - Config: `src/lib/auth.ts`
- @prisma/client ^6.19.1 - Database ORM client
  - Prisma CLI: ^6.19.1 (devDependency)
  - Schema: `prisma/schema.prisma`
- zod ^4.3.5 - Schema validation
- react-hook-form ^7.70.0 + @hookform/resolvers ^5.2.2 - Form management
- swr ^2.4.0 - Client-side data fetching/caching

**Infrastructure:**
- @upstash/ratelimit ^2.0.7 + @upstash/redis ^1.36.0 - Rate limiting via Redis
  - Config: `src/lib/rate-limit.ts`
- bcryptjs ^3.0.3 - Password hashing
- date-fns ^4.1.0 - Date manipulation
- sonner ^2.0.7 - Toast notifications
- next-themes ^0.4.6 - Theme (dark/light) management
- react-day-picker ^9.13.0 - Date picker component

**PDF Generation:**
- pdfkit ^0.17.2 - Server-side PDF generation (workout sheets)
  - Marked as serverExternalPackages in Next.js config
  - Custom font: FreeStyleScript (base64-embedded in `src/lib/fonts/FreeStyleScript.base64.ts`)
  - Logo: `public/logo-black.png`
  - Implementation: `src/lib/pdf.ts`
- pdf-lib ^1.17.1 - PDF manipulation library

**Security:**
- dompurify ^3.3.1 + isomorphic-dompurify ^2.35.0 - HTML sanitization (anamnesis data)

## Configuration

**Environment:**
- `.env` - Local defaults
- `.env.development` - Development overrides
- `.env.production` - Production overrides
- `.env.example` - Template with all required variables documented
- `.env.production.example` - Production-specific template

**Key env var categories:**
- `DATABASE_URL`, `DIRECT_URL` - PostgreSQL connection
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL` - Auth config
- `RESEND_API_KEY` - Email service
- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` - WhatsApp API
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` - Rate limiting
- `CRON_SECRET` - Cron job authentication
- `APP_TIMEZONE` - Scheduling timezone (default: America/Sao_Paulo)

**Build:**
- `next.config.ts` - Next.js configuration (CORS, security headers, server external packages)
- `tsconfig.json` - TypeScript (strict mode, `@/*` path alias to `./src/*`)
- `vercel.json` - Vercel deployment (region: gru1 / Sao Paulo)

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in both `tsconfig.json` and `vitest.config.ts`)

## Platform Requirements

**Development:**
- Node.js 20+ (Docker uses 20-alpine)
- PostgreSQL 16 (via Docker Compose or local install)
- npm for package management

**Production (Primary - Vercel):**
- Vercel hosting (region: `gru1` - Sao Paulo, Brazil)
- Supabase PostgreSQL (sa-east-1 region, connection pooling via pgbouncer on port 6543)
- Custom build: `prisma generate && migrations && test:run && next build`

**Production (Alternative - Docker):**
- Multi-stage Docker build (`Dockerfile`)
- Docker Compose with PostgreSQL 16-alpine (`docker-compose.yml`)
- Standalone Next.js output
- Health check endpoint: `GET /api/health`

## Utility Scripts

Located in `utility/` and `scripts/`, run via `tsx`:
- Data scrapers: `nextfit-scraper.ts`, `scrape-anamnesis.ts`
- Data imports: `import-schedule.ts`, `import-payments-lista.ts`
- Maintenance: `cleanup-inactive-members.ts`, `update-plans.ts`
- Preview: `preview-emails.ts`
- Migration: `sync-payments-to-supabase.ts`, `migrate-to-supabase.sh`

---

*Stack analysis: 2026-02-16*
