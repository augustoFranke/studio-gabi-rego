# Repo Map

This map captures the production architecture after the cleanup checkpoint and
the first refactor pass.

## Stack

- Next.js App Router 16, React 19, TypeScript, Tailwind CSS 4.
- NextAuth v5 with Prisma adapter and credentials auth.
- Prisma 6 with PostgreSQL.
- Vitest for unit/API tests and Playwright dependency for browser validation.
- Vercel deployment path with optional Prisma migrations during build.

## Runtime Boundaries

- `src/app`: routes, layouts, route handlers, and thin page shells.
- `src/features`: feature-level UI/contracts. New cleanup work should prefer
  this over adding more domain code directly inside route files.
- `src/services`: server-side use cases around Prisma and business rules.
- `src/schemas`: shared validation schemas used outside a single feature.
- `src/lib`: cross-cutting infrastructure such as auth, logging, dates, PDF,
  providers, rate limiting, and runtime config.
- `src/components`: reusable UI and admin/form components.
- `prisma`: schema and migrations.

## Core Flows

- Auth/onboarding: cadastro, email verification, password reset, profile
  completion, anamnese token submission.
- Scheduling: member/admin calendar reads and mutations through
  `agendamento.service`.
- Finance: plan and payment administration through finance UI, payment APIs,
  and `pagamento.service`.
- Training: ficha de treino CRUD, templates, editor utilities, and PDF
  generation.
- Notifications: daily scheduled jobs, WhatsApp cobranças, provider
  observability, and dedupe keys.

## Cleanup Rules Going Forward

- Keep App Router files as composition shells when practical.
- Put request contracts near the owning feature and import them into route
  handlers.
- Keep business rules in services/use cases, not client components.
- Read runtime environment through `src/lib/runtime-config.ts`.
- Add Prisma indexes with additive migrations first; avoid destructive schema
  changes without a separate data migration and rollback note.
- Treat large UI files as candidates for feature modules, then split into
  hooks/components once behavior is covered.
