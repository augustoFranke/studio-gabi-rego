# Codebase Structure

**Analysis Date:** 2026-02-11

## Directory Layout

```
project-root/
├── .planning/               # GSD planning documents
├── .github/                 # GitHub Actions workflows
├── docker/                  # Docker deployment configuration
│   ├── postgres/           # PostgreSQL init scripts
│   ├── nginx/              # Nginx reverse proxy config
│   └── scripts/            # Docker helper scripts
├── prisma/                 # Database schema and migrations
│   ├── migrations/         # Prisma migration history
│   ├── migrations_archived/# Old archived migrations
│   ├── schema.prisma       # Database schema definition
│   └── seed.ts             # Database seeding script
├── public/                 # Static assets (images, fonts, logos)
├── scripts/                # Development and deployment scripts
├── src/                    # Application source code
│   ├── app/               # Next.js App Router pages and API routes
│   ├── components/        # React UI components
│   ├── domain/            # Business entity type definitions
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utilities, helpers, and infrastructure
│   ├── schemas/           # Zod validation schemas
│   ├── services/          # Business logic and data access functions
│   ├── types/             # TypeScript type definitions
│   ├── instrumentation.ts # OpenTelemetry or monitoring setup
│   └── middleware.ts      # Next.js request middleware for auth/authz
├── utility/               # One-off utility scripts (web scrapers, data import/export)
├── next.config.ts         # Next.js build and runtime configuration
├── tsconfig.json          # TypeScript compiler configuration
├── tailwind.config.ts     # Tailwind CSS configuration
├── vitest.config.ts       # Vitest unit test configuration
└── package.json           # Node.js dependencies and scripts
```

## Directory Purposes

**src/app/:**
- Purpose: Server-rendered pages and API routes using Next.js App Router
- Contains: Route groups `(admin)`, `(aluno)`, `(auth)` for role-based layouts; API handlers; server actions; global layout and error handling
- Key files: `layout.tsx` (root), `page.tsx` (home), `error.tsx` (error boundary), `globals.css` (styling)
- Pattern: Group syntax `(groupname)` for layout scope without affecting URL path

**src/app/api/:**
- Purpose: RESTful API endpoints for frontend and external integrations
- Contains: Resource route handlers (`/api/membros`, `/api/treinos`, `/api/agendamentos`); authentication endpoints; cron job handlers; PDF generation
- Key files: `route.ts` in each endpoint directory
- Pattern: Each resource has directory with route.ts for GET, POST, PUT, DELETE methods

**src/app/(admin)/:**
- Purpose: Admin dashboard and management interfaces for studio staff
- Contains: Pages for members (`alunos/`), training programs (`treinos/`), schedule (`agenda/`), payments (`financeiro/`), settings (`configuracoes/`)
- Layout: Uses shared `layout.tsx` with sidebar, header, and role-based access checks
- Pages: `dashboard` (overview), `alunos/[id]` (member detail), `treinos/[id]/editar` (trainer editor)

**src/app/(aluno)/:**
- Purpose: Member-facing interface for students/gym members
- Contains: Pages for viewing training (`meu-treino/`), schedule (`minha-agenda/`), profile (`meu-perfil/`), payments (`pagamentos/`)
- Layout: Uses shared `layout.tsx` with member-specific sidebar
- Data: Members see only their own data (enforced via `membroId` in session)

**src/app/(auth)/:**
- Purpose: Authentication flow pages for login, signup, and onboarding
- Contains: `login/`, `cadastro/` (signup), `anamnese/` (health intake form), `completar-perfil/` (profile completion), `redefinir-senha/` (password reset), `verificar-email/` (email verification)
- No layout sidebar: Clean, minimal layout for auth forms
- Redirect: Authenticated users redirected to role-based dashboards

**src/app/actions/:**
- Purpose: Server actions for data mutations triggered by client-side forms
- Contains: `membros.ts` with actions like `toggleMembroStatus()`, `deleteMembro()`, `deactivateMembro()`
- Pattern: Each file has `'use server'` directive, Prisma calls, and cache revalidation
- Used by: Admin forms in `(admin)/alunos` pages

**src/components/ui/:**
- Purpose: Reusable Radix UI primitive components styled with Tailwind CSS
- Contains: `button.tsx`, `dialog.tsx`, `input.tsx`, `select.tsx`, `sidebar.tsx`, `card.tsx`, `badge.tsx`, `dropdown-menu.tsx`, etc.
- Pattern: Low-level, unstyled-by-default components that accept className props
- Generated: Initialized via shadcn/ui CLI (`components.json` config)

**src/components/admin/:**
- Purpose: Admin-specific composite components
- Contains: `alunos-filters.tsx` (member filter UI), `member-actions.tsx` (bulk actions), `treino-template-button.tsx` (template selector)
- Pattern: Combine multiple UI primitives with business logic

**src/components/forms/:**
- Purpose: Complex form components with validation
- Contains: `MemberForm.tsx` (create/edit member), and other domain-specific forms
- Pattern: React Hook Form + Zod validation, controlled inputs, error display

**src/components/schedule/:**
- Purpose: Calendar and scheduling UI components
- Contains: `daily-view.tsx`, `weekly-view.tsx`, `monthly-view.tsx` (different calendar views), `time-slot.tsx` (individual time slot), `agendamento-modal.tsx` (booking form), `schedule-header.tsx` (date/filter controls)
- Hook: `use-schedule.ts` manages calendar state, date navigation, filtering
- Data: Fetches from `/api/agendamentos` via SWR

**src/components/ (root):**
- Purpose: Global and layout components
- Contains: `admin-sidebar.tsx` (admin navigation), `aluno-sidebar.tsx` (member navigation), `error-boundary.tsx` (React error catching), `theme-provider.tsx` (dark mode), `theme-toggle.tsx` (theme switcher)

**src/lib/:**
- Purpose: Utilities and infrastructure code
- Key files:
  - `prisma.ts` - Singleton database client
  - `auth.ts` - NextAuth configuration, JWT provider, session/token callbacks
  - `api.ts` - `withApiAuth()` helper for route protection, `ensureOwnerOrAdmin()` helper for data ownership checks
  - `validators.ts` - Shared validation functions (CPF, email, date formatting, currency)
  - `utils.ts` - Generic utilities (classname merging, etc.)
  - `dates.ts` - Date manipulation helpers
  - `email.ts` - Email template and sending logic
  - `resend.ts` - Resend email service SDK configuration
  - `pdf.ts` - PDF generation utilities for training programs
  - `planos.ts` - Plan/pricing data and calculations
  - `schedule.ts` - Scheduling logic and recurring appointment sync
  - `fetcher.ts` - SWR data fetching helper
  - `rate-limit.ts` - Upstash Redis-based rate limiting
  - `shutdown.ts` - Graceful shutdown handler

**src/lib/jobs/:**
- Purpose: Background job implementations for scheduled tasks
- Contains: `cobranca-whatsapp.ts` (payment reminders via WhatsApp)

**src/lib/whatsapp/:**
- Purpose: WhatsApp integration via Evolution API
- Contains: `evolution.ts` (send messages, format numbers, check configuration)

**src/lib/treino/:**
- Purpose: Training program utilities and helpers
- Contains: `editor.ts` (training editor logic)

**src/services/:**
- Purpose: Business logic layer for data access and domain operations
- Contains:
  - `membro.service.ts` - Member listing and detail queries with optional compact projection
  - `agendamento.service.ts` - Schedule creation, conflict checking, recurring sync
  - `treino.service.ts` - Training program creation, validation, PDF generation
- Pattern: Async functions accepting typed parameters, using Prisma, returning strongly-typed results

**src/schemas/:**
- Purpose: Zod validation schemas for domain entities
- Contains:
  - `auth.schema.ts` - Login credentials, password reset schemas
  - `membro.schema.ts` - Member creation/update validation
  - `treino.schema.ts` - Training program validation (exercises, sessions, objectives)
- Pattern: Define once, use in both API routes and form validation

**src/domain/:**
- Purpose: TypeScript type definitions for business entities
- Contains: `treino.ts` with exercise, session, and PDF data types
- Pattern: Separate from schemas; used for runtime type safety and IDE autocomplete

**src/hooks/:**
- Purpose: Custom React hooks for data fetching and UI state management
- Contains:
  - `use-schedule.ts` - Calendar state (current date, view mode, filters), fetches from `/api/agendamentos`
  - `use-agenda-interactions.ts` - Scheduling form state and submission logic
  - `use-url-filters.ts` - Parse and sync URL query parameters with local state
  - `use-mobile.ts` - Media query hook for responsive design

**src/types/:**
- Purpose: Global TypeScript type definitions
- Contains: Session user interface, API response types

**prisma/schema.prisma:**
- Purpose: Database schema definition
- Entities: `Usuario` (auth user), `Membro` (gym member), `Plano` (pricing plan), `Agendamento` (schedule), `FichaTreino` (training program), `Pagamento` (payment), `Notificacao` (notification), `HorarioDisponivel` (available time slots), `Anamnese` (health questionnaire), `HorarioFixo` (member-specific fixed slots)
- Enums: `Role` (ADMIN, MEMBRO), `StatusMembro` (ATIVO, INATIVO, PENDENTE), `StatusPagamento` (PENDENTE, PAGO, ATRASADO, CANCELADO), `DiaSemana` (SEGUNDA-DOMINGO), `TipoNotificacao` (LEMBRETE_AULA, COBRANCA, ANIVERSARIO, AVISO_GERAL), `Sexo` (MASCULINO, FEMININO)
- Migrations: Located in `prisma/migrations/` with timestamps and descriptive names

**public/:**
- Purpose: Static assets served without processing
- Contains: Logo images, favicons, custom fonts (FreeStyleScript.ttf for PDF signature)

**utility/:**
- Purpose: One-off scripts for data import, export, scraping, and maintenance
- Contains: `nextfit-scraper.ts` (scrape external schedule), `scrape-anamnesis.ts`, `update-plans.ts`, `extract-plan-prices.ts`, `import-schedule.ts`, `preview-emails.ts`, `cleanup-inactive-members.ts`
- Execution: Run via `npm run [script-name]` with tsx runner

**docker/:**
- Purpose: Docker deployment configuration
- Contains:
  - `postgres/init/` - SQL scripts to initialize database
  - `nginx/` - Reverse proxy config with SSL
  - `scripts/` - Bash scripts for container lifecycle (start, stop, backup)
- File: `docker-compose.yml` defines services (app, postgres, nginx)

## Key File Locations

**Entry Points:**

- **Web App Root:** `src/app/layout.tsx` - Root layout, theme provider setup
- **Admin Dashboard:** `src/app/(admin)/dashboard/page.tsx` - Admin overview page
- **Member Home:** `src/app/(aluno)/inicio/page.tsx` - Member landing page
- **Auth Home:** `src/app/(auth)/login/page.tsx` - Login form
- **API Root:** `src/app/api/` - All REST endpoints
- **Middleware:** `src/middleware.ts` - Route protection and auth checks

**Configuration:**

- **TypeScript:** `tsconfig.json` - Compiler options, path aliases (`@/*` → `src/*`)
- **Next.js:** `next.config.ts` - Build, image optimization, security headers, CORS
- **Tailwind:** `tailwind.config.ts` - Design tokens and theme customization
- **Vitest:** `vitest.config.ts` - Test runner configuration
- **Database:** `prisma/schema.prisma` - Data model and migrations

**Core Logic:**

- **Auth:** `src/lib/auth.ts` - NextAuth provider, credentials validation, token/session callbacks
- **Database:** `src/lib/prisma.ts` - Singleton client
- **API Helper:** `src/lib/api.ts` - `withApiAuth()` and ownership checks
- **Scheduler:** `src/lib/scheduler.ts` - Batch notification processing
- **Services:** `src/services/` - Business logic per entity

**Testing:**

- **Test Files:** `src/__tests__/` - Unit and integration tests co-located by layer
- **Config:** `vitest.config.ts` - Test runner setup
- **Test Command:** `npm run test` or `npm run test:run`

## Naming Conventions

**Files:**

- `.ts` - Utility and library files
- `.tsx` - React components (pages, layouts, components)
- `route.ts` - Next.js API route handlers (not renamed)
- `layout.tsx` - Next.js layout components (not renamed)
- `page.tsx` - Next.js page components (not renamed)
- `middleware.ts` - Next.js request middleware (not renamed)
- `.service.ts` - Business logic service files (e.g., `membro.service.ts`)
- `.schema.ts` - Zod validation schemas (e.g., `auth.schema.ts`)
- `[id].tsx` - Dynamic route segment (e.g., `[id]/page.tsx`)
- `[...nextauth].ts` - Catch-all API route (NextAuth)

**Directories:**

- `(groupname)/` - Route groups for layout scope (parentheses excluded from URL)
- `components/ui/` - Shadcn/ui primitives
- `components/{feature}/` - Feature-specific composite components
- `lib/{feature}/` - Feature-specific utility subdirectories
- `__tests__/` - Test files mirror source structure

**React Components:**

- PascalCase file names: `AdminSidebar.tsx`, `MemberForm.tsx`, `TimeSlot.tsx`
- Functional components (not class)
- Server components by default (unless `'use client'` directive)
- Hooks exported from `hooks/` directory

**TypeScript:**

- Interfaces: PascalCase, describe shape of objects (e.g., `SessionUser`, `ApiOptions`)
- Types: PascalCase, describe specific data (e.g., `TreinoExercise`, `TrainingPDFData`)
- Enums: PascalCase in code, CamelCase in Prisma schema (`Role`, `StatusMembro`)

**Functions and Variables:**

- camelCase for functions and variables
- Services/utilities: descriptive names like `listMembros()`, `getMembroById()`, `syncAgendamentosRecorrentes()`
- Server actions: verb-first like `toggleMembroStatus()`, `deleteMembro()`, `deactivateMembro()`

## Where to Add New Code

**New Feature Page:**
- Primary code: `src/app/(role)/feature-name/page.tsx` (server component)
- Optional layout: `src/app/(role)/feature-name/layout.tsx` if specific styling/guards needed
- Sibling routes: Create subdirectories (e.g., `[id]/page.tsx` for detail, `[id]/editar/page.tsx` for edit)
- Tests: `src/__tests__/[feature]/ or co-locate with page

**New Component:**
- Reusable UI Primitive: `src/components/ui/component-name.tsx` (if domain-agnostic)
- Feature-Specific: `src/components/{feature}/component-name.tsx` (e.g., `src/components/admin/component-name.tsx`)
- Form Component: `src/components/forms/FeatureForm.tsx` with React Hook Form + Zod
- Pattern: Export from file, import as `import { ComponentName } from '@/components/...'`

**New API Endpoint:**
- REST Resource: `src/app/api/resource/route.ts` with GET/POST/PUT/DELETE methods
- Dynamic Resource: `src/app/api/resource/[id]/route.ts` for detail operations
- Validation: Import Zod schema from `src/schemas/`, validate in handler
- Auth: Wrap handler in `withApiAuth()` helper from `src/lib/api.ts`
- Tests: Create `src/__tests__/api/resource.test.ts`

**New Business Logic:**
- Service Function: `src/services/entity-name.service.ts` with async query/mutation functions
- Pattern: Accept typed parameters, return typed results, use Prisma directly
- Tests: `src/__tests__/services/entity-name.test.ts`

**New Server Action:**
- Location: `src/app/actions/feature-name.ts`
- Directive: Start with `'use server'`
- Pattern: Async functions, Prisma mutations, `revalidatePath()` after mutation
- Return: `{ success: boolean, error?: string, data?: T }`

**New Validation Schema:**
- Location: `src/schemas/entity.schema.ts`
- Pattern: Zod schema definition, export as constant
- Use: Import into API route for validation, into component for form validation
- Example: `export const memberCreateSchema = z.object({ ... })`

**New Utility/Helper:**
- Shared utility: `src/lib/utility-name.ts`
- Domain-specific: `src/lib/{feature}/utility-name.ts`
- Pattern: Export functions, no side effects, pure helpers
- Example: `src/lib/validators.ts` for validation helpers

**New Hook:**
- Location: `src/hooks/use-feature-name.ts` (always prefix with `use-`)
- Pattern: Custom React hook, manages state or side effects
- Data Fetching: Use SWR pattern with `fetcher` from `src/lib/fetcher.ts`
- Example: `src/hooks/use-schedule.ts` for calendar state

**New Type Definition:**
- Domain Type: `src/domain/entity-name.ts` for business entity types
- Global Type: `src/types/common.ts` for shared types used across layers
- API Schema Types: Inferred from Zod schemas via `z.infer<typeof schema>`

## Special Directories

**src/__tests__/:**
- Purpose: Unit and integration tests
- Generated: No (committed to repo)
- Organization: Mirrors `src/` structure (e.g., `__tests__/services/membro.test.ts` tests `services/membro.service.ts`)
- Pattern: Vitest with `describe()` and `it()` blocks
- Run: `npm run test` (watch) or `npm run test:run` (single run)

**prisma/migrations/:**
- Purpose: Prisma migration history for database schema changes
- Generated: Created by `prisma migrate dev` command
- Committed: Yes, to version control
- Do NOT manually edit migration files; use `prisma migrate dev` or `prisma db push`

**public/:**
- Purpose: Static files served at root (e.g., `public/logo.png` → `/logo.png`)
- Generated: No
- Committed: Yes
- Contents: Images, fonts, favicons, robots.txt

**docker/:**
- Purpose: Docker deployment configuration
- Generated: No
- Committed: Yes
- Use: Run `npm run docker:up` for local Docker development

**.next/:**
- Purpose: Next.js build output and cache
- Generated: Yes (by `npm run build`)
- Committed: No (in .gitignore)
- Ignore: All build artifacts

---

*Structure analysis: 2026-02-11*
