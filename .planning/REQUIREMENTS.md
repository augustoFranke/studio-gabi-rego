# Requirements: Studio Gabi Rego — Hardening & Performance

**Defined:** 2026-02-16
**Core Value:** The app must become production-hardened: secure, bug-free, performant, and protected by meaningful test coverage — without breaking existing functionality.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Security

- [x] **SEC-01**: Server actions verify caller session and require ADMIN role before executing
- [x] **SEC-02**: Rate limiter returns `{ success: false }` when Redis is unavailable in production
- [x] **SEC-03**: Cron endpoints use `crypto.timingSafeEqual` for secret comparison
- [x] **SEC-04**: Shared password policy (8+ chars, uppercase, number) used in both registration and member update flows
- [x] **SEC-05**: Unused dependencies removed from production bundle (pdf-lib to devDeps, dompurify + isomorphic-dompurify removed)

### Bug Fixes

- [x] **BUG-01**: `revalidatePath` calls in server actions target `/alunos` instead of non-existent `/membros`
- [x] **BUG-02**: Gender heuristic removed from anamnese route — returns null when `sexo` is not set

### Data Integrity

- [x] **DATA-01**: Single canonical anamnese field-key source in `src/lib/anamnese.ts` used across all anamnese routes
- [x] **DATA-02**: Missing member email persists as `null` (no placeholder generation), with deterministic placeholder-email migration tooling and report artifacts

### Database Performance

- [ ] **PERF-01**: Composite indexes added for `Pagamento(status, dataVencimento)`, `Membro(status)`, `Agendamento(data)`
- [ ] **PERF-02**: Birthday query filters at database level using `EXTRACT(MONTH/DAY)`
- [ ] **PERF-03**: Pagination added to `/api/membros`, `/api/horarios`, `/api/planos`

### Client Performance

- [ ] **PERF-04**: Financeiro page split into focused sub-components (PlanoCard, PagamentoTable, PagamentoDialog, FinanceiroStats)
- [ ] **PERF-05**: SWR caching with deduplication on financeiro data fetching
- [ ] **PERF-06**: Treinos generator page split into focused sub-components (exercise list, template selector, member selector)
- [ ] **PERF-07**: RSC conversion where applicable (financeiro shell, dashboard, other data-display pages)

### Maintainability

- [ ] **MAINT-01**: Email templates deduplicated using shared layout function or react-email components
- [ ] **MAINT-02**: Inline Zod schemas extracted from financeiro page to `src/schemas/`

### Test Coverage

- [ ] **TEST-01**: Middleware route protection tests verify admin/member/public access control
- [ ] **TEST-02**: Scheduler core logic tests cover deduplication, member filtering, and status transitions
- [ ] **TEST-03**: Middleware catch-all added — unmatched authenticated routes redirect to login

## v2 Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Observability

- **OBS-01**: Structured logging with log levels and aggregation
- **OBS-02**: Error tracking service integration (Sentry or equivalent)
- **OBS-03**: Audit log for admin operations (member deletion, payment changes)

### Testing

- **TEST-04**: E2E tests with Playwright for critical user flows
- **TEST-05**: Client-side component tests for admin pages

### Infrastructure

- **INFRA-01**: CI pipeline with GitHub Actions (lint, typecheck, test)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| New user-facing features | This is a hardening milestone — fix and optimize only |
| NextAuth v5 beta to stable migration | No stable v5 available; current impl is simple enough to adapt |
| Prisma Optimize / query tracing | Targeted indexes sufficient at current scale |
| Component library migration | shadcn/ui + Radix working well; visual regression risk |
| Next.js fetch cache / unstable_cache | SWR better fits the existing client-component pattern |
| Mobile app | Web-first, separate initiative |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Complete |
| SEC-02 | Phase 1 | Complete |
| SEC-03 | Phase 1 | Complete |
| SEC-04 | Phase 1 | Complete |
| BUG-01 | Phase 2 | Complete |
| BUG-02 | Phase 2 | Complete |
| SEC-05 | Phase 2 | Complete |
| DATA-01 | Phase 3 | Complete |
| DATA-02 | Phase 3 | Complete |
| PERF-01 | Phase 4 | Pending |
| PERF-02 | Phase 4 | Pending |
| PERF-03 | Phase 5 | Pending |
| TEST-01 | Phase 6 | Pending |
| TEST-02 | Phase 6 | Pending |
| TEST-03 | Phase 6 | Pending |
| PERF-04 | Phase 7 | Pending |
| MAINT-02 | Phase 7 | Pending |
| PERF-05 | Phase 8 | Pending |
| PERF-06 | Phase 9 | Pending |
| PERF-07 | Phase 9 | Pending |
| MAINT-01 | Phase 10 | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-16*
*Last updated: 2026-02-20 after Phase 3 execution — DATA-01, DATA-02 complete*
