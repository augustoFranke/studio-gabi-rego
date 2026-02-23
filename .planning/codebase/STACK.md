# Technology Stack

**Analysis Date:** 2026-02-11

## Languages

**Primary:**
- TypeScript 5 - All application code, API routes, and configuration
- React 19.2.3 - UI component framework with server components support

**Secondary:**
- JavaScript - Build configuration (next.config.ts)
- SQL - Database migrations and raw queries in Prisma schema

## Runtime

**Environment:**
- Node.js 20 (Alpine Linux variant) - Used in Docker/production
- Next.js 16.1.1 - Full-stack framework with App Router

**Package Manager:**
- npm - Primary package manager
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 16.1.1 - React framework with API routes, Server Actions, middleware
- React 19.2.3 - UI library with concurrent features
- React DOM 19.2.3 - React DOM rendering

**Authentication:**
- NextAuth.js 5.0.0-beta.30 - JWT-based authentication with Credentials provider
- @auth/prisma-adapter 2.11.1 - Prisma adapter for NextAuth

**Testing:**
- Vitest 4.0.17 - Fast unit test runner
- @vitest/coverage-v8 4.0.17 - Code coverage reporting
- Playwright 1.57.0 - Browser automation (available for E2E tests)

**Build/Dev:**
- TypeScript 5 - Type checking
- ESLint 9 - Code linting with Next.js config
- Tailwind CSS 4 - Utility-first CSS with @tailwindcss/postcss 4
- Husky 9.1.7 - Git hooks (pre-commit hooks configured)

## Key Dependencies

**Critical:**
- @prisma/client 6.19.1 - Database ORM client
- prisma 6.19.1 - Database toolkit and migrations

**UI Components & Styling:**
- @radix-ui packages (1.1.x - 2.2.x) - Headless UI primitives (Avatar, Dialog, Dropdown, Label, Popover, ScrollArea, Select, Separator, Slot, Tabs, Tooltip)
- lucide-react 0.562.0 - Icon library with tree-shaking optimization
- class-variance-authority 0.7.1 - Type-safe CSS variant composition
- clsx 2.1.1 - Conditional className utility
- tailwind-merge 3.4.0 - Merge Tailwind CSS classes safely
- sonner 2.0.7 - Toast notification library

**Forms & Validation:**
- react-hook-form 7.70.0 - Performant form management
- @hookform/resolvers 5.2.2 - Validation resolvers for Zod
- zod 4.3.5 - TypeScript-first schema validation

**Date/Time:**
- date-fns 4.1.0 - Modular date utilities
- react-day-picker 9.13.0 - Calendar picker component

**PDF Generation:**
- pdfkit 0.17.2 - PDF document generation (Node.js)
- pdf-lib 1.17.1 - PDF manipulation and creation

**External Services:**
- bcryptjs 3.0.3 - Password hashing
- dompurify 3.3.1 - XSS sanitization (browser)
- isomorphic-dompurify 2.35.0 - XSS sanitization (isomorphic)

**Infrastructure:**
- @upstash/ratelimit 2.0.7 - Rate limiting via Upstash
- @upstash/redis 1.36.0 - Redis client for Upstash
- swr 2.4.0 - Data fetching with caching and revalidation
- next-themes 0.4.6 - Theme management (light/dark mode)
- cmdk 1.1.1 - Command menu component

**Utilities:**
- tsx 4.21.0 - TypeScript executor for scripts
- tw-animate-css 1.4.0 - Animation utilities

## Configuration

**Environment:**
- Managed via `.env`, `.env.development`, `.env.production` files
- Key configs:
  - `DATABASE_URL` - PostgreSQL connection string (with connection pooling)
  - `DIRECT_URL` - Direct PostgreSQL connection for migrations
  - `NEXTAUTH_SECRET` - JWT signing secret
  - `NEXTAUTH_URL` - Authentication base URL
  - `NEXT_PUBLIC_APP_URL` - Public app URL for email links
  - `RESEND_API_KEY` - Email service API key
  - `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` - WhatsApp API
  - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` - Redis configuration
  - `APP_TIMEZONE`, `CRON_SECRET` - Scheduling configuration
  - `CORS_ALLOWED_ORIGIN` - CORS policy configuration

**Build:**
- `next.config.ts` - Next.js configuration with:
  - Image optimization (disabled for Docker, enabled for Vercel)
  - Security headers (X-Frame-Options, CSP, HSTS, CORS)
  - Experimental features (Server Actions, package import optimization)
  - PDF file tracing for static generation
- `tsconfig.json` - TypeScript configuration with strict mode and path aliases (`@/*` → `./src/*`)
- `.eslintrc.mjs` - ESLint configuration
- `vitest` configuration (in package.json) for test runner

## Platform Requirements

**Development:**
- Node.js 20 or later
- npm 9+ for package management
- PostgreSQL 16+ (local via Docker or Supabase)
- Supports macOS, Linux, Windows (with WSL)

**Production:**
- Deployment options:
  - **Vercel**: Optimized Next.js hosting with automatic image optimization
  - **Docker**: Standalone deployment with multi-stage build (`node:20-alpine`)
    - Container health checks enabled
    - Non-root user (nodejs:1001) for security
    - Exposed on port 3000
  - **Database**: Supabase PostgreSQL with connection pooler (pgbouncer)
  - **External services**: Resend (email), Upstash Redis (rate limiting), Evolution API (WhatsApp)

**Deployment Scripts:**
- `vercel-build` - Vercel-specific build with Prisma migrations
- Docker Compose configuration for local multi-container setup
- Pre-commit hooks via Husky for linting and tests

---

*Stack analysis: 2026-02-11*
