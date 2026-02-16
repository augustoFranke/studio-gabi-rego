# Technology Stack — Hardening & Performance

**Project:** Studio Gabi Rego — Hardening & Performance milestone
**Researched:** 2026-02-16
**Scope:** Libraries and tooling needed to harden and optimize the existing Next.js 16 / Prisma 6 / Supabase app. This document covers only what must be **added or changed**, not the existing stack.

---

## What Changes and Why

The existing stack (Next.js 16.1.1, Prisma 6, Supabase, Vercel, Vitest 4, SWR 2, Zod 4) is already installed and correct. This milestone requires additions in four areas:

1. **Server action security** — unauthenticated server actions are exploitable right now.
2. **Client component testing** — zero coverage on all UI components and pages.
3. **Bundle visibility** — cannot identify unused dependencies without analysis tooling.
4. **Email template maintainability** — 948-line HTML blob needs structural replacement.

---

## Recommended Additions

### 1. Server Action Security — `next-safe-action`

| | |
|---|---|
| **Package** | `next-safe-action` |
| **Version** | `^8.0.11` (current stable as of 2026-02) |
| **Confidence** | HIGH — verified via npm registry |

**Why:** The audit found that `src/app/actions/membros.ts` exposes `toggleMembroStatus`, `deleteMembro`, and `deactivateMembro` without any session check. Any authenticated user (MEMBRO role) can call these directly. `next-safe-action` v8 solves this with a composable middleware chain — you define an authenticated action client once, attach auth middleware to it, and every action created from that client is automatically gated.

The alternative (manually calling `auth()` at the top of each server action) works but is fragile: adding a new action requires remembering the pattern. `next-safe-action` enforces it structurally.

**What it provides:**
- Typed, validated server actions with Zod schemas at the action boundary.
- A middleware system where you attach `auth()` once to an action client; all actions derived from it inherit the auth check.
- `useAction` / `useStateAction` client hooks that replace ad-hoc `useState` + action call patterns.
- Works with the existing `src/lib/auth.ts` / NextAuth v5 setup without changes.

**Migration scope:** Only `src/app/actions/membros.ts` and any new server actions going forward. Existing API routes (`withApiAuth`) are unaffected.

```bash
npm install next-safe-action
```

**Do not use:** Raw server actions without auth checks (the current pattern). This is not just style — it is a security vulnerability exploitable by any logged-in member.

---

### 2. Client Component Testing — `@testing-library/react` + supporting packages

The current Vitest setup uses `environment: 'node'`. Testing client components requires a DOM environment.

| Package | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| `@testing-library/react` | `^16.3.2` | Render and interact with React components | HIGH — verified npm |
| `@testing-library/user-event` | `^14.6.1` | Simulate real user interactions (click, type) | HIGH — verified npm |
| `@testing-library/jest-dom` | `^6.9.1` | DOM matchers for Vitest (`toBeInTheDocument`, etc.) | HIGH — verified npm |
| `@vitejs/plugin-react` | `^5.1.4` | React transform plugin for Vitest in jsdom mode | HIGH — verified npm |
| `jsdom` | `^28.1.0` | DOM environment for Vitest | HIGH — verified npm |
| `vite-tsconfig-paths` | `^6.1.1` | Honour `@/*` path alias in Vitest/jsdom tests | HIGH — verified npm |

**Why this set:** This is the combination the official Next.js testing documentation recommends as of February 2026. All packages are actively maintained and version-aligned. Testing Library's API is stable and compatible with Vitest's Jest-compatible `expect`.

**Limitation to acknowledge (MEDIUM confidence):** Async React Server Components cannot be unit-tested with Vitest + jsdom — this is a fundamental React/Vitest limitation as of early 2026. The targets in this milestone are client components (the 1,612-line financeiro page and extracted sub-components). Testing RSC async data-fetching paths requires Playwright E2E, which is out of scope. Synchronous server components and all client components are testable.

**Setup required:** A second Vitest config (`vitest.jsdom.config.ts`) with `environment: 'jsdom'` and the React plugin. Keeps existing `vitest.config.ts` (node environment) for API and service tests unchanged — no regressions.

```bash
npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom @vitejs/plugin-react jsdom vite-tsconfig-paths
```

**Do not use:**
- Jest — the project already uses Vitest; adding Jest creates two runners, doubles config overhead, and introduces version conflicts with Vitest mocks.
- Enzyme — unmaintained, not compatible with React 19.

---

### 3. Bundle Analysis — `@next/bundle-analyzer`

| | |
|---|---|
| **Package** | `@next/bundle-analyzer` |
| **Version** | `^16.1.6` (matches Next.js 16.1.1 installed) |
| **Confidence** | HIGH — official Next.js package, verified npm |

**Why:** The audit identified three likely-unused dependencies: `pdf-lib`, `dompurify`, and `isomorphic-dompurify`. Removing them blind is risky. The bundle analyzer produces treemap visualizations (client bundle, server bundle, edge bundle) that show exactly which modules import which dependencies. This makes the decision data-driven: if `pdf-lib` shows zero import chains, remove it with confidence.

Next.js 16.1 also ships an experimental Turbopack-compatible bundle analyzer — `@next/bundle-analyzer` is the stable path that works with both Webpack and Turbopack builds.

**Usage pattern:**
```bash
ANALYZE=true npm run build
# Opens three browser tabs: client.html, nodejs.html, edge.html
```

**Configuration in `next.config.ts`:**
```typescript
import withBundleAnalyzer from '@next/bundle-analyzer'

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

export default bundleAnalyzer(nextConfig)
```

```bash
npm install -D @next/bundle-analyzer
```

**Do not use:**
- `webpack-bundle-analyzer` directly — `@next/bundle-analyzer` wraps it with Next.js-aware defaults. Direct use requires replicating Next.js webpack configuration.
- `source-map-explorer` — works only on source maps, misses tree-shaking opportunities visible in the treemap.

---

### 4. Email Template Refactoring — `react-email` + `@react-email/components`

| Package | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| `react-email` | `^5.2.8` | Preview server + render utility | HIGH — verified npm |
| `@react-email/components` | `^0.0.x` (latest) | Unstyled email primitives (Html, Head, Body, Container, Text, Link, Button, Img) | HIGH — official Resend package |

**Why:** `src/lib/resend.ts` contains 7 full HTML email templates as inline template literals, totalling ~948 lines where 90% is duplicated boilerplate (header, footer, styling, layout tables). Updating the brand design means editing 7 copies. React Email replaces this with composable React components that render to email-safe HTML via `render()`.

The project already uses Resend for sending. Resend is built by the React Email team — the integration is a first-class path with zero new service dependencies.

**How it fits:** The 7 templates become React components in `src/emails/`. A shared `EmailLayout` component holds the duplicated boilerplate. `render(TemplateComponent, { props })` produces the HTML string that replaces the current inline template literals. The `resend.emails.send()` call interface is unchanged.

```bash
npm install react-email @react-email/components
```

**Scope caveat:** React Email adds a render dependency (`@react-email/render`) that runs server-side only. It does not add client bundle weight.

**Do not use:** Raw HTML string concatenation (the current approach) — maintaining it is demonstrably fragile. MJML is an alternative but adds a separate compiler step and has less Next.js/React ecosystem integration.

---

## Security Fixes Using Only Existing Stack

These fixes require **no new dependencies** — only code changes using built-in Node.js APIs and libraries already installed:

### Rate Limiter Fail-Closed

**Fix:** Add a `NODE_ENV` guard in `src/lib/rate-limit.ts`. When `UPSTASH_REDIS_REST_URL` is missing in production (`NODE_ENV === 'production'`), return `{ success: false, limit: 0, remaining: 0 }` instead of allowing the request.

```typescript
// src/lib/rate-limit.ts — change fail-open to fail-closed in production
if (!process.env.UPSTASH_REDIS_REST_URL) {
  if (process.env.NODE_ENV === 'production') {
    console.error('CRITICAL: Rate limiting disabled in production — rejecting request')
    return { success: false, limit: 0, remaining: 0, reset: 0 }
  }
  // Development: allow through with warning
  console.warn('Rate limiting disabled (development mode)')
  return { success: true, limit: 999, remaining: 999, reset: 0 }
}
```

No new package needed. This is pure logic.

### Timing-Safe Cron Token Comparison

**Fix:** Replace string equality with `crypto.timingSafeEqual` in both cron routes.

```typescript
// Use Node.js built-in crypto — no new dependency
import { timingSafeEqual } from 'crypto'

const incoming = Buffer.from(token)
const expected = Buffer.from(process.env.CRON_SECRET!)
if (incoming.length !== expected.length || !timingSafeEqual(incoming, expected)) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### Password Policy Unification

**Fix:** Extract the stricter registration password rule from `src/app/api/auth/cadastro/route.ts` into a shared Zod schema in `src/schemas/auth.schema.ts`. Reference it from `src/schemas/membro.schema.ts`.

No new package needed. Zod 4 (already installed) handles this with `.refine()`.

---

## Database Optimization Using Only Existing Stack

**No new tooling needed.** Prisma's `@@index` directive in `prisma/schema.prisma` followed by `prisma migrate dev` is the complete solution.

Specific indexes to add (based on audit findings):

```prisma
// On Pagamento model — queries filter by status and sort/filter by dataVencimento
@@index([status, dataVencimento])

// On Membro model — queries filter active/inactive members
@@index([status])

// On Agendamento model — queries filter by date range
@@index([data])
```

The birthday query fix (`processarAniversarios()`) uses Prisma's `$queryRaw` to push `EXTRACT(MONTH FROM ...)` filtering to PostgreSQL. This is already available in Prisma 6 and requires no library upgrade.

---

## What NOT to Add

| Candidate | Verdict | Reason |
|-----------|---------|--------|
| Sentry / error tracking | Out of scope | Explicitly excluded from this milestone in PROJECT.md |
| Playwright E2E tests | Out of scope | Explicitly excluded from this milestone |
| Redux / Zustand | No | SWR already handles server state; no global client state needed |
| React Query / TanStack Query | No | SWR is already installed and working for this use case |
| `depcheck` | Useful one-time tool, not a dep | Run `npx depcheck` ad-hoc; do not add as a project dependency |
| MJML | No | React Email is a simpler path with better Resend integration |
| `next-safe` (headers) | No | Security headers are already configured in `next.config.ts` |
| Jest | No | Vitest is already installed; two test runners is pure overhead |
| `eslint-plugin-security` | Optional, low priority | Current ESLint config covers most patterns; adding it mid-milestone risks noise |

---

## Installation Summary

```bash
# Security: server action auth enforcement
npm install next-safe-action

# Testing: client component coverage
npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom @vitejs/plugin-react jsdom vite-tsconfig-paths

# Bundle analysis: identify and confirm unused deps
npm install -D @next/bundle-analyzer

# Email: reduce 948-line HTML duplication
npm install react-email @react-email/components

# Remove confirmed-unused dependencies (verify with bundle analyzer first)
# npm uninstall pdf-lib dompurify isomorphic-dompurify
```

---

## Sources

- next-safe-action docs and changelog: [https://next-safe-action.dev/](https://next-safe-action.dev/)
- Next.js official Vitest testing guide (updated 2026-02-11): [https://nextjs.org/docs/app/guides/testing/vitest](https://nextjs.org/docs/app/guides/testing/vitest)
- Next.js bundle analyzer official docs: [https://nextjs.org/docs/app/guides/package-bundling](https://nextjs.org/docs/app/guides/package-bundling)
- React Email (Resend-maintained): [https://react.email](https://react.email)
- Prisma index documentation: [https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes](https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes)
- SWR usage with Next.js: [https://swr.vercel.app/docs/with-nextjs](https://swr.vercel.app/docs/with-nextjs)
- Upstash ratelimit-js (fail behavior): [https://github.com/upstash/ratelimit-js](https://github.com/upstash/ratelimit-js)
- Timing-safe auth with Web Crypto: [https://www.arun.blog/timing-safe-auth-web-crypto/](https://www.arun.blog/timing-safe-auth-web-crypto/)

---

*Research completed: 2026-02-16*
