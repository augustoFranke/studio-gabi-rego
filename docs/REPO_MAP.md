# REPO_MAP

## Purpose
This repository is a Next.js 16 monolith for a fitness studio (Studio Gabi Rego), with role-separated experiences for admins and members, backed by Prisma + PostgreSQL. It manages member onboarding, schedules, training plans, payments, notifications, and operational imports.

## High-Level Tree

```text
.
├── src/                  # Application source (App Router pages, APIs, services, libs, tests)
├── prisma/               # Prisma schema + SQL migrations + seed + Supabase RLS helper
├── scripts/              # Operational scripts (dev startup, deployment checks, DB migration helper)
├── utility/              # One-off import/scrape/migration tools
├── docker/               # Docker deployment scripts and Postgres init
├── .github/workflows/    # CI pipeline
├── .github/              # PR templates and repo workflow metadata
├── AGENTS.md             # Canonical agent operating guide
├── RUNBOOK.md            # Payment import runbook
├── docs/DEPLOYMENT.md    # Canonical deployment contract
├── docs/WORKFLOW.md      # Canonical branch/PR workflow
├── package.json          # Build/run/test/db scripts and dependencies
├── next.config.ts        # Runtime security/CORS/header and output tracing config
├── docker-compose.local.yml # Local-only app + postgres smoke harness
└── vercel.json           # Vercel build/runtime settings
```

## Entry Points
- Web entry: `src/app/layout.tsx`, `src/app/page.tsx`
- Route-group UI shells:
  - `src/app/(admin)/layout.tsx`
  - `src/app/(aluno)/layout.tsx`
  - `src/app/(auth)/layout.tsx`
- API entry root: `src/app/api/**/route.ts`
- Auth provider endpoint: `src/app/api/auth/[...nextauth]/route.ts`
- Middleware gate: `src/proxy.ts`
- Cron endpoints:
  - `src/app/api/cron/cobrancas-whatsapp/route.ts`
  - `src/app/api/cron/tarefas-diarias/route.ts`
- Utility CLI import entry: `utility/import-payments-feb-2026-docx.ts`

## Core Modules And Responsibilities
- `src/lib/auth.ts`: NextAuth credentials provider, JWT/session callbacks, auth cache wrapper.
- `src/lib/api.ts`: API guard helpers (`withApiAuth`, `ensureOwnerOrAdmin`, request validation).
- `src/lib/prisma.ts`: singleton Prisma client lifecycle.
- `src/services/agendamento.service.ts`: recurring schedule generation, future-scope mutations, fixed-slot validation.
- `src/services/membro.service.ts`: member listing and create orchestration.
- `src/services/pagamento.service.ts`: payment reads and payment mutation orchestration.
- `src/services/perfil.service.ts`: onboarding/profile completion, token issuance, and token-based completion flow.
- `src/services/treino.service.ts`: training CRUD orchestration and exercise mapping.
- `src/lib/scheduler.ts`: notification orchestration (email/WhatsApp) and overdue payment updates.
- `src/lib/payments/feb2026-import.ts`: audited DOCX payment import, matching, idempotency, rollback.
- `src/app/api/*`: role-aware resource endpoints for members, plans, schedules, payments, profiles, training, notifications.

## Key Dependencies (From Manifests/Config)
- Framework/runtime: `next@16.1.1`, `react@19.2.3`, `typescript@5` (`package.json`)
- Auth: `next-auth@5.0.0-beta.30`, `@auth/prisma-adapter`
- Data: `prisma@6.19.1`, `@prisma/client`
- Validation/forms: `zod`, `react-hook-form`, `@hookform/resolvers`
- UI: Radix UI packages, `tailwindcss@4`, `lucide-react`, `sonner`, `swr`
- Integrations: `@upstash/ratelimit`, `@upstash/redis`, Resend API via fetch, Evolution API via fetch
- PDF: `pdfkit`, `pdf-lib`

## Run, Test, Build (Discoverable Commands)
From `package.json`:
- Dev: `npm run dev`
- Local guided dev bootstrap: `npm run dev:local`
- Local Docker smoke test: `docker compose -f docker-compose.local.yml up --build`
- Build: `npm run build`
- Start: `npm run start`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Tests: `npm run test:run`
- Migrations deploy: `npm run db:migrate:deploy`
- Vercel build path: `npm run vercel-build`

## Hot Spots (Churn + Centrality)
Most changed files (historical `git log --name-only` frequency):
- `package.json` (18)
- `src/lib/pdf.ts` (17)
- `src/app/(admin)/financeiro/page.tsx` (17)
- `src/lib/resend.ts` (15)
- `src/app/api/membros/route.ts` (15)
- `src/app/api/membros/[id]/route.ts` (14)
- `src/app/(auth)/completar-perfil/page.tsx` (14)
- `src/components/forms/MemberForm.tsx` (13)
- `src/app/api/auth/cadastro/route.ts` (13)
- `src/app/(auth)/anamnese/page.tsx` (13)

Operationally central modules with repeated changes include auth/session (`src/lib/auth.ts`), onboarding/profile services, scheduling APIs/services, finance pages/APIs, and payment import tooling.

## Evidence
### Files
- `package.json` (scripts, dependencies)
- `src/app/**`, `src/app/api/**` (entrypoints, role-specific routes)
- `src/lib/auth.ts`, `src/lib/api.ts`, `src/lib/prisma.ts` (core infrastructure)
- `src/services/agendamento.service.ts`, `src/services/treino.service.ts` (business orchestration)
- `prisma/schema.prisma`, `prisma/migrations/**` (data model and evolution)
- `next.config.ts`, `vercel.json`, `Dockerfile`, `docker-compose.local.yml`, `.github/workflows/ci.yml` (runtime/deploy topology)

### Commits
- `f5bc767` - initial Vercel + Supabase deployment baseline with core app skeleton.
- `8f771b7` - added fixed weekly slots (`horarios_fixos`) across schema/API/forms.
- `9702602` - added notifications and cron surfaces.
- `70fb9fe` - introduced audited payment import model and tooling.
- `3274441` - refined payment import status handling and local dev bootstrap script.
- `3ef8cd4` - optimization pass across frontend/server scheduling queries.

## Uncertainty
- No explicit ADR folder exists; decision rationale is inferred from code, commit messages, and operational docs (`AGENTS.md`, `RUNBOOK.md`).
- No explicit production cron scheduler definition is in-repo (endpoint contracts exist; external trigger config is out-of-repo).
