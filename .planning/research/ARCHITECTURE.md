# Architecture Patterns

**Domain:** Gym management SaaS — Next.js 16 + Prisma + PostgreSQL refactor
**Researched:** 2026-02-16

---

## Current Architecture Assessment

The app uses Next.js 16 App Router with route groups `(admin)`, `(aluno)`, `(auth)`. A services layer exists (`src/services/`), API routes are under `src/app/api/`, and Prisma queries occasionally appear directly in page components. The split between RSC and client components is inconsistent: some admin pages are already proper RSC (alunos list, dashboard, aluno detail), while others are 1600-line monolithic client components.

**What is already correct:**
- `(admin)/alunos/page.tsx` — RSC, direct Prisma query, `unstable_cache` wrapping
- `(admin)/alunos/[id]/page.tsx` — RSC, direct Prisma query
- `(admin)/dashboard/page.tsx` — RSC, `unstable_cache`, parallel async data
- `(aluno)/pagamentos/page.tsx`, `meu-treino/page.tsx` — correctly use SWR
- `src/hooks/use-schedule.ts` — correctly uses SWR with deduplication
- `src/lib/fetcher.ts` — SWR fetcher utility exists but is underused

**What is wrong:**
- `(admin)/financeiro/page.tsx` — 1612 lines, `"use client"`, all data fetched in `useEffect` with manual state, no SWR
- `(admin)/treinos/gerador/page.tsx` — 785 lines, `"use client"`, member list and template list fetched in `useEffect` with manual state, no SWR
- `(admin)/treinos/[id]/editar/page.tsx` — 674 lines, `"use client"`, entire page client-side
- `src/lib/resend.ts` — 948 lines with 7 near-identical HTML email template functions
- `prisma/schema.prisma` — no `@@index` directives on any model despite several query patterns that need them

---

## Recommended Architecture

### Layer Boundaries

```
Browser
  └─ Client Components ('use client')
       ├─ Interactive forms (dialogs, CRUD modals)
       ├─ Filtered/paginated tables with real-time search
       ├─ SWR hooks for polling / optimistic updates
       └─ Event handlers (onClick, onChange)

Next.js Server (RSC)
  └─ Page shells (layout, headings, static structure)
       ├─ Static data sections (stats cards, read-only tables)
       ├─ Suspense boundaries wrapping async sub-components
       └─ Direct Prisma queries (no client round-trip)

API Routes (/api/*)
  └─ Mutations only (POST, PUT, PATCH, DELETE)
       ├─ Paginated list endpoints consumed by SWR
       └─ Stats endpoints consumed by SWR or RSC

Services (/src/services/*)
  └─ Business logic extracted from both routes and pages
       ├─ Complex queries with joins
       └─ Side effects (email, WhatsApp, PDF)
```

### Component Boundaries

| Component | Responsibility | Type | Communicates With |
|-----------|---------------|------|-------------------|
| Page shell (`page.tsx`) | Layout, heading, initial RSC data, Suspense wrappers | RSC | Async sub-components, client islands |
| Stats cards | Display aggregate numbers | RSC (initially), or SWR hook | API `/stats` endpoint |
| Data table (read-only) | Display paginated list with filters | Client (SWR) | `/api/*` paginated endpoint |
| CRUD dialog | Add/edit/delete form | Client | API mutation routes, SWR `mutate()` |
| Filter bar | Search, status filter, sort controls | Client | Lifted state to parent table component |
| Email templates | HTML string builders | Pure functions (no React) | Called from API routes and cron jobs |

---

## RSC Conversion Patterns

### Pattern 1: Page Shell + Client Island

**What:** Keep the outer `page.tsx` as RSC. Extract only the interactive part to a `*-client.tsx` file.

**When:** Any page where the header, title, and static info can be rendered server-side, and only a table or form needs interactivity.

**Example — Financeiro:**
```typescript
// src/app/(admin)/financeiro/page.tsx  (RSC)
import { FinanceiroStats } from '@/components/admin/financeiro/financeiro-stats'
import { PagamentosClient } from '@/components/admin/financeiro/pagamentos-client'
import { PlanosClient } from '@/components/admin/financeiro/planos-client'
import { prisma } from '@/lib/prisma'
import { Suspense } from 'react'

export default async function FinanceiroPage() {
  // Stats fetched server-side — no client round-trip
  const stats = await prisma.pagamento.groupBy(/* ... */)

  return (
    <div className="space-y-6">
      <h1>Financeiro</h1>
      <FinanceiroStats stats={stats} />          {/* RSC, static */}
      <Suspense fallback={<TableSkeleton />}>
        <PagamentosClient />                     {/* Client island */}
      </Suspense>
      <Suspense fallback={<CardsSkeleton />}>
        <PlanosClient />                         {/* Client island */}
      </Suspense>
    </div>
  )
}
```

**Benefit:** Stats render in the RSC pass (no client JS). Pagamentos and Planos sections load independently via Suspense, so a slow pagamentos query does not block the stats display.

### Pattern 2: SWR for Interactive Tables

**What:** Replace manual `useEffect + useState + fetch` with `useSWR`. The fetcher in `src/lib/fetcher.ts` already exists and is correctly typed.

**When:** Any client component that fetches a list, applies filters, or refreshes after a mutation.

**Example — replacing financeiro fetchPagamentos:**
```typescript
// src/components/admin/financeiro/pagamentos-client.tsx
'use client'

import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import { useUrlFilters } from '@/hooks/use-url-filters'

export function PagamentosClient() {
  const { search, status, sort, page } = useUrlFilters()

  const params = new URLSearchParams({ page, search, status, sort })
  const { data, isLoading, mutate } = useSWR(
    `/api/pagamentos?${params}`,
    fetcher,
    { keepPreviousData: true }   // prevents table flash on filter change
  )

  // CRUD handlers call mutate() after each operation
}
```

**Why `keepPreviousData: true`:** Prevents the table from disappearing while loading the next page/filter result. This is the SWR 2.x equivalent of React Query's `placeholderData: keepPreviousData`.

### Pattern 3: SWR Server Prefetch (for initial load performance)

**What:** Fetch initial data in RSC, pass it as SWR `fallback` to avoid a client waterfall on first render.

**When:** Pages where initial data is known at server render time and the data will later need client-side revalidation (e.g., member details that also have an edit dialog).

**Example:**
```typescript
// page.tsx  (RSC)
import { SWRConfig } from 'swr'
import { unstable_serialize } from 'swr'
import { prisma } from '@/lib/prisma'

export default async function TreinosPage() {
  const membros = await prisma.membro.findMany({
    where: { status: 'ATIVO' },
    select: { id: true, usuario: { select: { nome: true } } }
  })

  return (
    <SWRConfig value={{ fallback: {
      [unstable_serialize('/api/membros?status=ATIVO&fields=compact')]: membros
    }}}>
      <TreinosGeradorClient />
    </SWRConfig>
  )
}
```

**Benefit:** The gerador page loads members from RSC HTML — zero client fetch waterfall for initial render. SWR handles subsequent revalidation in the background.

### Pattern 4: RSC-Native for Static List Pages

**What:** Pages that display filtered/sorted lists without real-time mutation (alunos list, treinos list) stay as RSC with URL search params for filtering.

**When:** The page does not require optimistic updates or real-time polling. Navigation between pages via URL is acceptable UX.

**Already done:** `alunos/page.tsx`, `treinos/page.tsx` follow this pattern correctly. Do not convert these to client components.

---

## Component Splitting: Financeiro Page (1612 lines)

The financeiro page contains five distinct responsibilities that must be split:

```
financeiro/
  page.tsx                          (RSC shell ~40 lines)
  components/
    financeiro-stats.tsx            (RSC, async, reads stats from props or server)
    pagamentos-client.tsx           (Client, SWR, filter+pagination+table)
    pagamentos-form-dialog.tsx      (Client, add/edit payment dialog)
    pagamentos-delete-dialog.tsx    (Client, delete confirmation)
    planos-client.tsx               (Client, SWR, plans grid)
    planos-form-dialog.tsx          (Client, add/edit plan dialog)
```

**Build order:** Split dialogs first (lowest risk, purely additive). Then extract the pagamentos table. Then extract the planos section. Then convert page.tsx shell to RSC. This order allows incremental testing at each step.

## Component Splitting: Treinos Gerador (785 lines)

```
treinos/gerador/
  page.tsx                          (RSC shell with SWRConfig prefetch)
  components/
    gerador-client.tsx              (Client, main form state)
    member-selector.tsx             (Client, combobox, useSWR for members)
    template-selector.tsx           (Client, combobox, useSWR for templates)
    session-builder.tsx             (Client, drag-free session list)
    exercise-row.tsx                (Client, single exercise input row)
```

## Component Splitting: Email Templates (resend.ts, 948 lines)

```
lib/
  resend.ts                         (keep: enviarEmail(), isResendConfigured())
  email/
    base-layout.ts                  (shared HTML wrapper, header, footer)
    templates/
      lembrete-aula.ts              (single template, uses base-layout)
      cobranca.ts
      verificacao-email.ts
      redefinir-senha.ts
      boas-vindas.ts
      anamnese.ts
      aniversario.ts                (if present)
```

The `base-layout.ts` extracts the common outer HTML (DOCTYPE, body, brand wrapper, footer). Each template file calls `baseLayout({ title, headerColor, content })` and fills in only the unique inner content. This reduces each template to ~30 lines and eliminates the 7-way duplication.

---

## Data Flow

### Decision: When RSC vs When SWR

```
Does the data change without user action? (polling, realtime)
  YES → SWR with { refreshInterval }
  NO  → Continue below

Does the data need to update after a user mutation on the same page?
  YES → SWR with mutate() after POST/PUT/DELETE
  NO  → Continue below

Is the data available at server render time?
  YES → RSC direct Prisma query
  NO  → Not applicable (can't be RSC)

Does the user filter/sort/paginate this data interactively?
  YES → Client component + SWR with dynamic key
  NO  → RSC direct Prisma query
```

### Concrete data flow for the refactored financeiro page:

```
1. Browser requests /admin/financeiro
2. RSC page.tsx:
   a. Fetches stats via Prisma (no API round-trip)
   b. Fetches initial planos via Prisma for SWRConfig fallback
   c. Returns HTML with stats rendered, Suspense shells for client islands
3. Client hydrates:
   a. PagamentosClient mounts → SWR fetches /api/pagamentos?page=1
   b. PlanosClient mounts → SWR resolves from fallback (no fetch needed)
4. User filters pagamentos:
   a. URL params update → SWR key changes → new fetch with keepPreviousData
5. User creates payment:
   a. Dialog submits to POST /api/pagamentos
   b. On success: mutate() invalidates pagamentos key + stats key
   c. Table and stats update simultaneously
```

---

## Database Index Strategy

### Current State

The Prisma schema has zero `@@index` directives except implicit `@unique` constraints. The following queries run on every page load and will benefit from composite indexes.

### Required Indexes

**Pagamentos — most-queried table:**
```prisma
model Pagamento {
  // ... existing fields ...

  @@index([membroId])                          // member detail page
  @@index([status])                            // financeiro filter by status
  @@index([status, dataVencimento])            // overdue check + stats
  @@index([dataVencimento])                    // monthly revenue calc
  @@index([membroId, status])                  // per-member pending check
  @@map("pagamentos")
}
```

**Agendamentos — schedule queries:**
```prisma
model Agendamento {
  // ... existing fields ...

  @@index([membroId, data])                    // member's schedule by date
  @@index([horarioId, data])                   // slot occupancy by date
  @@index([data])                              // dashboard "today's classes"
  @@map("agendamentos")
}
```

**Notificacoes — cron job queries:**
```prisma
model Notificacao {
  // ... existing fields ...

  @@index([enviada, agendadaPara])             // cron: find unsent + scheduled
  @@index([membroId])                          // member notification lookup
  @@map("notificacoes")
}
```

**FichaTreino — member training history:**
```prisma
model FichaTreino {
  // ... existing fields ...

  @@index([membroId, ativo])                   // active plans per member
  @@map("fichas_treino")
}
```

**Membro — list/search queries:**
```prisma
model Membro {
  // ... existing fields ...

  @@index([status])                            // filter by ATIVO/INATIVO
  @@index([planoId])                           // members per plan (financeiro)
  @@map("membros")
}
```

**Ordering rationale:** Composite indexes should match the leftmost prefix rule. For `status + dataVencimento`, queries that filter only on `status` will use this index. Queries that filter on both will use the full composite. Queries that filter only on `dataVencimento` need a separate single-column index — include `@@index([dataVencimento])` alongside the composite.

**Index build order:** Add indexes in a single migration. In PostgreSQL, `CREATE INDEX` on an existing table is a full table scan, which takes time proportional to row count. For this gym's scale (hundreds to low thousands of rows), the migration will complete in under a second. No `CONCURRENTLY` flag is needed.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: useEffect Data Fetching
**What:** `useEffect(() => { fetch('/api/...').then(setData) }, [])` for list data.
**Why bad:** No deduplication, no cache, no stale-while-revalidate, loading state managed manually, race conditions on filter changes (the financeiro page has a manual requestId counter to work around this).
**Instead:** `useSWR('/api/...', fetcher)` — the `fetcher.ts` utility already handles error normalization.

### Anti-Pattern 2: Giant Single-File Client Components
**What:** 1600-line `"use client"` files with forms, tables, dialogs, and data fetching all in one module.
**Why bad:** Entire JS bundle must load before any interaction is possible. TypeScript compilation is slow. Testing is impractical. A change in the delete dialog requires re-bundling the entire financeiro feature.
**Instead:** See component split above. Each island is independently bundled and lazy-loaded.

### Anti-Pattern 3: Passing Server Data Through Props Waterfall
**What:** RSC fetches data, passes through three component layers as props to reach the component that actually needs it.
**Why bad:** Couples RSC and client component boundaries, breaks colocation.
**Instead:** Colocate data fetching with the component that uses it. Use SWRConfig fallback at the page level only for genuine prefetch optimization.

### Anti-Pattern 4: `force-dynamic` Without Reason
**What:** `export const dynamic = "force-dynamic"` on every RSC page.
**Why bad:** Disables static rendering and full-route cache for pages that could be cached.
**Instead:** Only add `force-dynamic` when the page reads request-time data (cookies, headers, searchParams). The alunos list with `searchParams` is correct. The dashboard without searchParams could use `unstable_cache` with a revalidation tag instead.

### Anti-Pattern 5: HTML String Templates Without Shared Base
**What:** Seven email template functions each copy the same 80-line outer HTML wrapper.
**Why bad:** A brand change (logo URL, footer text, color) requires 7 edits. One was already missed causing inconsistency.
**Instead:** Extract `baseLayout(content, options)` function. Each template passes only the unique body content.

---

## Scalability Considerations

| Concern | Current Scale (~200 members) | At 2K members | At 10K members |
|---------|------------------------------|---------------|----------------|
| Pagamentos query | No index, sequential scan, fast (small table) | Slow without index | Unacceptable without index |
| Agendamentos by date | No index, sequential scan | Slow | Unacceptable |
| Dashboard stats | Direct Prisma query, `force-dynamic` | Add `unstable_cache` revalidation | Dedicated materialized view or scheduled computation |
| Email queue | Inline cron job | Add Redis-based job queue | Separate worker process |
| Bundle size | Single large client bundles | Impact felt in mobile LCP | RSC split required |

---

## Refactoring Order (Dependencies Between Changes)

The order below minimizes risk by deferring RSC boundary changes until component splits are complete.

```
Phase 1 — Infrastructure (no behavior change)
  1a. Add Prisma @@index directives → run migration
  1b. Extract email base-layout → split resend.ts into email/ module
  1c. Verify SWR fetcher.ts is imported everywhere useEffect-fetch exists

Phase 2 — Treinos refactor (smaller, lower risk)
  2a. Split gerador/page.tsx: extract member-selector and template-selector
  2b. Replace useEffect fetches with useSWR in extracted components
  2c. Convert gerador/page.tsx shell to RSC + SWRConfig prefetch
  2d. Split treinos/[id]/editar/page.tsx (same pattern)

Phase 3 — Financeiro refactor (largest change, do after Phase 2 proves pattern)
  3a. Extract planos-form-dialog.tsx and pagamentos-form-dialog.tsx
  3b. Extract delete confirmation dialogs
  3c. Extract PlanosClient with useSWR
  3d. Extract PagamentosClient with useSWR (keepPreviousData)
  3e. Convert financeiro/page.tsx shell to RSC, fetch stats server-side

Phase 4 — Remaining client pages
  4a. alunos/[id]/anamnese/page.tsx — assess RSC conversion potential
  4b. configuracoes/page.tsx — already uses SWR, likely fine as-is
  4c. agenda/page.tsx — legitimately client-only (calendar interactions), leave as-is
```

**Hard dependency:** Phase 3e (RSC shell conversion) must come after 3c and 3d. The RSC shell cannot render without the client islands being independently defined. Attempting the RSC conversion before extracting the client islands results in a server-render-incompatible file.

**No dependency:** Phase 1 (database indexes) is fully independent and should be done first — it has zero code risk and provides immediate query performance gains.

---

## Sources

- [Next.js: Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — MEDIUM confidence (official, verified current)
- [SWR with Next.js (official docs)](https://swr.vercel.app/docs/with-nextjs) — HIGH confidence (official Vercel docs, verified February 2026)
- [SWR Prefetching](https://swr.vercel.app/docs/prefetching) — HIGH confidence (official)
- [Prisma Indexes Documentation](https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes) — HIGH confidence (official Prisma docs)
- [Prisma: Improving query performance using indexes](https://www.prisma.io/blog/improving-query-performance-using-indexes-1-zuLNZwBkuL) — HIGH confidence (official Prisma blog)
- [Vercel: How to optimize RSC payload size](https://vercel.com/kb/guide/how-to-optimize-rsc-payload-size) — MEDIUM confidence (official Vercel KB)
- [SWR + Suspense for client-side data fetching discussion](https://github.com/vercel/next.js/discussions/53049) — MEDIUM confidence (community, Next.js repo)
- [Is SWR recommended with Next.js 15+ Server Actions?](https://github.com/vercel/swr/discussions/4095) — MEDIUM confidence (community, SWR repo)
- Direct codebase inspection (all specific line counts, component structure, schema analysis) — HIGH confidence
