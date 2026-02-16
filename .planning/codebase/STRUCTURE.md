# Codebase Structure

**Analysis Date:** 2026-02-16

## Directory Layout

```
gabi-rego-studio/
├── .claude/                    # Claude AI configuration and skills
│   └── skills/                 # Security check, React best practices
├── .github/
│   └── workflows/
│       └── ci.yml              # CI pipeline
├── .husky/                     # Git hooks (pre-commit runs tests)
├── .planning/                  # GSD planning documents
│   └── codebase/               # Architecture/structure analysis
├── backups/                    # Database backup scripts
├── docker/                     # Docker deployment config
│   ├── nginx/                  # Nginx reverse proxy + SSL
│   ├── postgres/               # PostgreSQL init scripts
│   └── scripts/                # Docker helper scripts
├── prisma/                     # Database schema and migrations
│   ├── migrations/             # Prisma migration history
│   ├── migrations_archived/    # Old migrations (pre-init)
│   ├── schema.prisma           # Database schema definition
│   └── seed.ts                 # Database seeding script
├── public/                     # Static assets (logo, fonts)
├── scripts/                    # One-off admin/migration scripts
├── src/                        # Application source code
│   ├── __tests__/              # Test files (mirrors src/ structure)
│   ├── app/                    # Next.js App Router pages & API
│   ├── components/             # React components
│   ├── domain/                 # Domain type definitions
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Shared utilities and clients
│   ├── schemas/                # Zod validation schemas
│   ├── services/               # Business logic services
│   └── types/                  # TypeScript type declarations
├── utility/                    # Data import/export/scraping tools
├── docker-compose.yml          # Docker Compose configuration
├── Dockerfile                  # Production Docker image
├── next.config.ts              # Next.js configuration
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── vercel.json                 # Vercel deployment config
└── vitest.config.ts            # Test configuration
```

## Directory Purposes

**`src/app/` - Next.js App Router:**
- Purpose: All pages, layouts, API routes, and server actions
- Contains: Route groups `(admin)`, `(aluno)`, `(auth)` plus `api/` and `actions/`
- Key files:
  - `layout.tsx`: Root layout with ThemeProvider, Toaster, fonts
  - `page.tsx`: Root redirect logic (auth check, onboarding routing)
  - `globals.css`: Global Tailwind CSS styles

**`src/app/(admin)/` - Admin Pages:**
- Purpose: Admin-only pages (studio owner/manager)
- Contains: Dashboard, student management, training sheets, financials, schedule, settings
- Key files:
  - `layout.tsx`: Auth guard (ADMIN role), sidebar shell with `AdminSidebar`
  - `dashboard/page.tsx`: Main admin dashboard
  - `alunos/page.tsx`: Student list page
  - `alunos/[id]/page.tsx`: Student detail page
  - `alunos/[id]/editar/page.tsx`: Student edit form
  - `alunos/[id]/anamnese/page.tsx`: Student health questionnaire
  - `alunos/novo/page.tsx`: New student form
  - `treinos/page.tsx`: Training sheet list
  - `treinos/[id]/page.tsx`: Training sheet detail
  - `treinos/[id]/editar/page.tsx`: Training sheet editor
  - `treinos/gerador/page.tsx`: Training PDF generator
  - `financeiro/page.tsx`: Financial overview
  - `agenda/page.tsx`: Schedule management (weekly/daily/monthly views)
  - `configuracoes/page.tsx`: System settings

**`src/app/(aluno)/` - Member Pages:**
- Purpose: Student/member-facing pages
- Contains: Home, personal schedule, training view, payments, profile
- Key files:
  - `layout.tsx`: Auth guard (MEMBRO or ADMIN), sidebar shell with `AlunoSidebar`
  - `inicio/page.tsx`: Member home/dashboard
  - `minha-agenda/page.tsx`: Personal schedule view
  - `meu-treino/page.tsx`: View assigned training sheets
  - `pagamentos/page.tsx`: Payment history and status
  - `meu-perfil/page.tsx`: Profile management

**`src/app/(auth)/` - Auth Pages:**
- Purpose: Public and semi-public authentication flows
- Contains: Login, registration, email verification, password reset, profile completion, anamnese
- Key files:
  - `layout.tsx`: Client component with `SessionProvider` wrapper
  - `login/page.tsx`: Login form
  - `cadastro/page.tsx`: Registration form
  - `verificar-email/[token]/page.tsx`: Email verification handler
  - `redefinir-senha/[token]/page.tsx`: Password reset form
  - `completar-perfil/page.tsx`: Onboarding step 2 (profile details)
  - `anamnese/page.tsx`: Onboarding step 3 (health questionnaire)

**`src/app/api/` - API Routes:**
- Purpose: RESTful backend endpoints
- Contains: 33 route files organized by resource (see ARCHITECTURE.md for full listing)
- Pattern: Each `route.ts` exports named HTTP method handlers (GET, POST, PUT, PATCH, DELETE)

**`src/app/actions/` - Server Actions:**
- Purpose: Server-side mutations callable from client components
- Contains: `membros.ts` (toggle status, delete, deactivate)
- Pattern: `'use server'` directive, returns `{ success, error? }` object

**`src/components/` - React Components:**
- Purpose: Reusable UI components
- Organized by domain:
  - `ui/`: Shadcn/ui primitives (button, card, dialog, form, input, select, table, tabs, tooltip, etc.)
  - `admin/`: Admin-specific components (`member-actions.tsx`, `treino-template-button.tsx`, `alunos-filters.tsx`)
  - `schedule/`: Schedule view components (`weekly-view.tsx`, `daily-view.tsx`, `monthly-view.tsx`, `time-slot.tsx`, `agendamento-modal.tsx`, `day-detail-modal.tsx`, `member-badge.tsx`, `schedule-header.tsx`, `time-slot-popover.tsx`, `use-schedule-data.ts`)
  - `forms/`: Form components (`MemberForm.tsx`)
  - Root: `admin-sidebar.tsx`, `aluno-sidebar.tsx`, `theme-provider.tsx`, `theme-toggle.tsx`, `error-boundary.tsx`

**`src/domain/` - Domain Types:**
- Purpose: Core domain type definitions separate from API/DB types
- Contains: `treino.ts` (TreinoExerciseInput, TreinoExercise, TreinoFicha, TreinoTemplate, TrainingPDFData, etc.)

**`src/hooks/` - Custom Hooks:**
- Purpose: Reusable React hooks
- Contains:
  - `use-schedule.ts`: Full schedule CRUD operations with SWR (create, update, delete, move agendamentos)
  - `use-agenda-interactions.ts`: Schedule UI interaction logic
  - `use-url-filters.ts`: URL query param state management
  - `use-mobile.ts`: Mobile breakpoint detection

**`src/lib/` - Shared Libraries:**
- Purpose: Core infrastructure, utilities, and external service clients
- Key files:
  - `auth.ts`: NextAuth v5 configuration (Credentials provider, JWT callbacks, session strategy)
  - `prisma.ts`: Prisma Client singleton (global caching for hot reload)
  - `api.ts`: `withApiAuth()`, `validateRequest()`, `ensureOwnerOrAdmin()` utilities
  - `resend.ts`: Resend email client + HTML email templates (verification, password reset, reminders, birthday, welcome)
  - `whatsapp/evolution.ts`: Evolution API WhatsApp client (send text messages, number formatting)
  - `rate-limit.ts`: Upstash Redis rate limiter (sliding window, IP-based)
  - `pdf.ts`: PDFKit-based training sheet PDF generator
  - `schedule.ts`: Schedule constants, date utilities, event grouping logic
  - `dates.ts`: Timezone-aware date helpers (YMD format, BR formatting)
  - `validators.ts`: Brazilian data validators (CPF, email, phone, currency, date formatting)
  - `anamnese.ts`: Anamnese field whitelist and sanitizer
  - `planos.ts`: Plan categorization helper
  - `fetcher.ts`: SWR fetcher with typed error handling (`FetchError` class)
  - `email.ts`: Email normalization utility
  - `utils.ts`: General utilities (likely `cn()` for Tailwind class merging)
  - `scheduler.ts`: Aggregated scheduled task runner (reminders, birthdays, overdue payments, recurring appointments)
  - `shutdown.ts`: Graceful shutdown handlers (Prisma disconnect)
  - `treino/editor.ts`: Training editor utilities
  - `fonts/FreeStyleScript.base64.ts`: Embedded font for PDF generation
  - `jobs/cobranca-whatsapp.ts`: WhatsApp billing reminder job logic

**`src/schemas/` - Zod Schemas:**
- Purpose: Request body validation with Zod + inferred TypeScript types
- Contains:
  - `auth.schema.ts`: Auth-related validation schemas
  - `membro.schema.ts`: `membroCreateSchema`, `membroUpdateSchema` with Brazilian data transforms (CPF, phone, precoCustomizado)
  - `treino.schema.ts`: `exercicioSchema`, `fichaCreateSchema`, `fichaUpdateSchema`, `treinoTemplateSchema`, `trainingPdfSchema`

**`src/services/` - Business Logic:**
- Purpose: Complex database operations and business rules
- Contains:
  - `membro.service.ts`: `listMembros()`, `getMembroById()` with Prisma includes
  - `treino.service.ts`: Full CRUD for fichas de treino, exercise replacement, template management
  - `agendamento.service.ts`: `validateHorarioFixoLimit()`, `syncAgendamentosRecorrentes()` (recurring appointment generation from fixed schedules)

**`src/types/` - TypeScript Types:**
- Purpose: Shared TypeScript type declarations and module augmentations
- Contains:
  - `schedule.ts`: Schedule-related interfaces (ScheduleView, Membro, Agendamento, SlotData, DayData, WeekData, etc.)
  - `next-auth.d.ts`: NextAuth module augmentation (adds `role`, `membroId` to session user)

**`src/__tests__/` - Tests:**
- Purpose: Unit and integration tests (Vitest)
- Structure mirrors source: `actions/`, `api/`, `lib/`, `pdf/`, `schemas/`, `services/`

**`prisma/` - Database:**
- Purpose: Prisma ORM schema, migrations, and seeding
- Key files:
  - `schema.prisma`: 14 models, 7 enums. All Portuguese field names with `@map()` to snake_case DB columns
  - `seed.ts`: Database seed script
  - `migrations/`: 6 migration files (init, senha_definida, anamnese_tokens, RLS, horarios_fixos, notificacao_ref_key)

**`scripts/` - Admin Scripts:**
- Purpose: One-off maintenance and migration scripts
- Contains:
  - `fix-onboarding-status.ts`: Fix onboarding status for existing users
  - `migrate-payments.ts`: Payment data migration
  - `check-deployment.sh`: Deployment verification
  - `migrate-to-supabase.sh`: Supabase migration script

**`utility/` - Data Tools:**
- Purpose: External data import/export/scraping utilities (not part of main app)
- Contains: NextFit scraper, anamnesis scraper, plan price extractor, schedule importer, email preview, inactive member cleanup
- Run via: `npm run scrape:nextfit`, `npm run import:schedule`, etc.

**`docker/` - Docker Config:**
- Purpose: Self-hosted deployment infrastructure
- Contains: Nginx reverse proxy config with SSL, PostgreSQL init scripts, start/stop/backup shell scripts

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root layout (ThemeProvider, fonts, Toaster)
- `src/app/page.tsx`: Root page (auth redirect router)
- `src/middleware.ts`: Request middleware (auth + role enforcement)
- `src/instrumentation.ts`: Server startup hooks (shutdown handlers)

**Configuration:**
- `next.config.ts`: Next.js config (security headers, CORS, pdfkit externals, standalone output for Docker)
- `tsconfig.json`: TypeScript config (strict mode, `@/*` path alias to `./src/*`)
- `vitest.config.ts`: Test runner config
- `eslint.config.mjs`: ESLint config
- `postcss.config.mjs`: PostCSS/Tailwind config
- `components.json`: Shadcn/ui config
- `vercel.json`: Vercel deployment (region: gru1/Sao Paulo)
- `docker-compose.yml`: Docker services (app, postgres, nginx)
- `Dockerfile`: Production Docker image
- `.env.example`, `.env.production.example`: Environment variable templates

**Core Logic:**
- `src/lib/auth.ts`: Authentication configuration
- `src/lib/api.ts`: API middleware utilities
- `src/lib/prisma.ts`: Database client
- `src/services/*.service.ts`: Business logic
- `src/lib/scheduler.ts`: Background task orchestrator
- `src/lib/pdf.ts`: PDF generation

**Testing:**
- `src/__tests__/`: All test files
- `vitest.config.ts`: Test configuration

## Naming Conventions

**Files:**
- Pages: `page.tsx` (Next.js convention)
- Layouts: `layout.tsx` (Next.js convention)
- API routes: `route.ts` (Next.js convention)
- Components: `kebab-case.tsx` (e.g., `admin-sidebar.tsx`, `member-badge.tsx`)
- Exception: `MemberForm.tsx` uses PascalCase
- Services: `kebab-case.service.ts` (e.g., `membro.service.ts`)
- Schemas: `kebab-case.schema.ts` (e.g., `membro.schema.ts`)
- Hooks: `use-kebab-case.ts` (e.g., `use-schedule.ts`)
- Lib utilities: `kebab-case.ts` (e.g., `rate-limit.ts`)
- Type declarations: `kebab-case.ts` or `kebab-case.d.ts`

**Directories:**
- Route groups: `(group-name)` (e.g., `(admin)`, `(aluno)`, `(auth)`)
- Dynamic routes: `[param]` (e.g., `[id]`)
- Catch-all routes: `[...param]` (e.g., `[...nextauth]`)
- Feature directories: Portuguese names matching domain (`alunos`, `treinos`, `financeiro`, `agenda`)
- Component directories: English names matching purpose (`ui`, `admin`, `schedule`, `forms`)

**Database:**
- Models: PascalCase Portuguese (e.g., `Membro`, `FichaTreino`, `HorarioDisponivel`)
- Fields: camelCase Portuguese (e.g., `dataNascimento`, `horarioId`)
- DB columns: snake_case via `@map()` (e.g., `data_nascimento`, `horario_id`)
- Tables: snake_case plural via `@@map()` (e.g., `membros`, `fichas_treino`)
- Enums: UPPER_CASE Portuguese (e.g., `ATIVO`, `SEGUNDA`, `COBRANCA`)

## Where to Add New Code

**New Admin Page:**
- Create: `src/app/(admin)/{feature-name}/page.tsx`
- For dynamic routes: `src/app/(admin)/{feature-name}/[id]/page.tsx`
- Auth is handled by `(admin)/layout.tsx` (requires ADMIN role)
- Add navigation link in `src/components/admin-sidebar.tsx`

**New Member Page:**
- Create: `src/app/(aluno)/{feature-name}/page.tsx`
- Auth is handled by `(aluno)/layout.tsx` (requires MEMBRO or ADMIN)
- Add navigation link in `src/components/aluno-sidebar.tsx`
- Add route to `MEMBER_ROUTES` in `src/middleware.ts`

**New API Endpoint:**
- Create: `src/app/api/{resource}/route.ts` (collection) or `src/app/api/{resource}/[id]/route.ts` (item)
- Use `withApiAuth()` from `src/lib/api.ts` for authentication
- Use `validateRequest()` from `src/lib/api.ts` with a Zod schema from `src/schemas/`
- If public, add route to `PUBLIC_ROUTES` in `src/middleware.ts`

**New Service:**
- Create: `src/services/{resource}.service.ts`
- Import Prisma from `src/lib/prisma.ts`
- Import types from `@prisma/client` or `src/domain/`
- Export standalone functions (no classes)

**New Zod Schema:**
- Create: `src/schemas/{resource}.schema.ts`
- Export both the schema and inferred type (`export type X = z.infer<typeof xSchema>`)

**New Component:**
- UI primitive: `src/components/ui/{component-name}.tsx` (follow Shadcn/ui patterns)
- Feature-specific: `src/components/{feature}/{component-name}.tsx`
- Page-level: co-locate in the page directory or place in appropriate `components/` subdirectory

**New Hook:**
- Create: `src/hooks/use-{name}.ts`
- Use SWR for data fetching, import `fetcher` from `src/lib/fetcher.ts`
- Follow pattern in `src/hooks/use-schedule.ts`

**New Domain Type:**
- Add to existing file in `src/domain/` or create `src/domain/{resource}.ts`
- For API response types, prefer `src/types/`

**New Background Job:**
- Job logic: `src/lib/jobs/{job-name}.ts`
- Cron endpoint: `src/app/api/cron/{job-name}/route.ts` (verify `CRON_SECRET`)
- Add to `src/lib/scheduler.ts` if it should run with the email task batch

**New Database Model:**
- Add model to `prisma/schema.prisma`
- Run `npm run db:migrate` to create migration
- Run `npm run db:generate` to update Prisma Client

**New Test:**
- Create: `src/__tests__/{layer}/{feature}.test.ts`
- Mirror the source structure (e.g., test for `src/services/membro.service.ts` goes in `src/__tests__/services/membro.service.test.ts`)

**New Utility Script:**
- Create: `utility/{script-name}.ts`
- Add npm script in `package.json` under `scripts` (use `tsx` runner)
- For one-off admin tasks: `scripts/{script-name}.ts`

## Special Directories

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes
- Committed: No

**`.next/`:**
- Purpose: Next.js build output and cache
- Generated: Yes
- Committed: No

**`prisma/migrations/`:**
- Purpose: Database migration history
- Generated: Yes (by `prisma migrate dev`)
- Committed: Yes (required for `prisma migrate deploy`)

**`prisma/migrations_archived/`:**
- Purpose: Old migrations from before schema reset
- Generated: No
- Committed: Yes (historical reference)

**`utility/csv/`:**
- Purpose: Scraped CSV data and browser cache from utility scripts
- Generated: Yes
- Committed: Partially (CSVs yes, browser data no)

**`tmp/`:**
- Purpose: Temporary files during development
- Generated: Yes
- Committed: No (should be in .gitignore)

**`backups/`:**
- Purpose: Database backup outputs
- Generated: Yes
- Committed: Partially

**`.claude/skills/`:**
- Purpose: Claude AI skill definitions for code assistance
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-02-16*
