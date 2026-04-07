# POLICY_DECISIONS

This document captures policies enforced (or implied) by code/config, including known gaps.

## Security Policies

## 1) Session + Role Enforcement
- Policy: Protected routes and APIs require authenticated sessions; role boundaries separate admin and member capabilities.
- Enforcement:
  - Route layer: `src/proxy.ts`
  - API layer: `src/lib/api.ts` (`withApiAuth`, `requiredRole`)
  - Ownership checks: `ensureOwnerOrAdmin`
- Gaps/TODOs:
  - Role/permission model is coarse (ADMIN vs MEMBRO only).
- Evidence:
  - `src/proxy.ts`
  - `src/lib/api.ts`
  - `src/app/api/*/route.ts` using `withApiAuth`

## 2) Password + Email Verification Requirements
- Policy: Signup/reset passwords must satisfy complexity; login is blocked until email verification and password setup are complete. Onboarding completion is service-driven and uses dedicated token namespaces for email verification, profile completion, and anamnesis handoff.
- Enforcement:
  - `src/app/api/auth/cadastro/route.ts`
  - `src/app/api/auth/redefinir-senha/route.ts`
  - `src/app/api/auth/verificar-email/route.ts`
  - `src/app/api/anamnese-token/route.ts`
  - `src/app/api/membros/[id]/perfil-link/route.ts`
  - `src/services/perfil.service.ts`
  - `src/services/membro.service.ts`
  - `src/lib/auth.ts`
- Gaps/TODOs:
  - No account lockout policy beyond rate limiting.
  - The onboarding state machine should remain centralized in service code rather than route/page side effects.
- Evidence:
  - `src/lib/auth.ts`
  - `src/schemas/auth.schema.ts`
  - `src/__tests__/api/auth-cadastro.test.ts`

## 3) API Rate Limiting
- Policy: IP-based sliding-window rate limiting is applied to sensitive auth endpoints.
- Enforcement:
  - `src/lib/rate-limit.ts` (5 requests / 1 minute)
  - Used in auth/nextauth/signup/reset routes
- Gaps/TODOs:
  - In production, missing Upstash config logs critical warning and fails open.
- Evidence:
  - `src/lib/rate-limit.ts`
  - `src/app/api/auth/[...nextauth]/route.ts`
  - `src/app/api/auth/cadastro/route.ts`

## 4) Cron Endpoint Protection
- Policy: Cron APIs require `Authorization: Bearer <CRON_SECRET>`.
- Enforcement:
  - `src/app/api/cron/cobrancas-whatsapp/route.ts`
  - `src/app/api/cron/tarefas-diarias/route.ts`
- Gaps/TODOs:
  - No in-repo IP allowlist/signature verification policy.
- Evidence:
  - `src/app/api/cron/*/route.ts`
  - `src/__tests__/api/cron-cobrancas-whatsapp.test.ts`
  - `src/__tests__/api/cron-tarefas-diarias.test.ts`

## 5) Security Headers + CORS
- Policy: Global defensive headers and API CORS headers are set by Next config.
- Enforcement:
  - `next.config.ts` (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, conditional HSTS, API CORS headers)
- Gaps/TODOs:
  - No CSP policy is defined in current config.
- Evidence:
  - `next.config.ts`

## Privacy Policies

## 6) PII Collection Scope
- Policy: System stores member personal data (name, email, CPF, phone, birth date, anamnesis).
- Enforcement/Location:
  - Prisma models `Usuario`, `Membro`, `Anamnese` in `prisma/schema.prisma`
- Gaps/TODOs:
  - No explicit in-repo data minimization/retention matrix.
  - No field-level encryption policy in application code.
- Evidence:
  - `prisma/schema.prisma`
  - `src/app/api/perfil/route.ts`
  - `src/app/api/minha-anamnese/route.ts`

## 7) Placeholder Email Handling
- Policy: Placeholder local emails are treated as non-contact emails in admin listing contexts.
- Enforcement:
  - `src/lib/email.ts` (`normalizeEmail` hides `@placeholder.local` values)
- Gaps/TODOs:
  - Placeholder records are still persisted in DB (for admin-created users without real email).
- Evidence:
  - `src/lib/email.ts`
  - `src/app/api/membros/route.ts` (admin-created temporary email path)

## 8) Input Sanitization (Anamnese Payload)
- Policy: Anamnese payload only allows predefined keys and string/null values.
- Enforcement:
  - `src/lib/anamnese.ts`
  - Applied in token and admin/member anamnesis APIs
- Gaps/TODOs:
  - Generalized sanitization/redaction policy for all logs/payloads is not centralized.
- Evidence:
  - `src/lib/anamnese.ts`
  - `src/app/api/anamnese-token/route.ts`
  - `src/app/api/membros/[id]/anamnese/route.ts`

## Data Retention / Deletion Policies

## 9) Hard Delete Behaviors
- Policy: Some entities are physically deleted (not soft deleted), including member account cascade deletion and schedule deletions.
- Enforcement:
  - `src/app/actions/membros.ts` (delete user cascades member and relations)
  - `src/app/api/agendamentos/[id]/route.ts` delete operations
- Gaps/TODOs:
  - No soft-delete retention policy for operational recovery.
- Evidence:
  - `src/app/actions/membros.ts`
  - `prisma/schema.prisma` FK delete actions

## 10) Payment Import Audit Retention
- Policy: Import operations are auditable via run/log tables and rollback lineage.
- Enforcement:
  - Tables: `pagamento_import_runs`, `pagamento_import_logs`
  - Runtime logic: `src/lib/payments/feb2026-import.ts`
- Gaps/TODOs:
  - No automatic purge/archive policy for import logs.
- Evidence:
  - `prisma/migrations/20260223103841_add_pagamento_import_audit/migration.sql`
  - `src/lib/payments/feb2026-import.ts`

## Permissions And Payments Policies

## 11) Finance Write Controls
- Policy: Payment/plan mutation endpoints are admin-only; members can only read scoped data.
- Enforcement:
  - `requiredRole: 'ADMIN'` in mutating handlers for plans/payments
  - `ensureOwnerOrAdmin` and role filtering in reads
- Gaps/TODOs:
  - No fine-grained permission split within admin role.
- Evidence:
  - `src/app/api/pagamentos/route.ts`
  - `src/app/api/pagamentos/[id]/route.ts`
  - `src/app/api/planos/*.ts`

## 12) Payment Status Transition Rules
- Policy: Marking payment as `PAGO` sets payment date; reverting to pending/canceled clears date.
- Enforcement:
  - `src/app/api/pagamentos/[id]/route.ts`
- Gaps/TODOs:
  - No explicit transition-state machine persisted outside handler logic.
- Evidence:
  - `src/app/api/pagamentos/[id]/route.ts`
  - `src/__tests__/api/pagamentos-id.test.ts`

## Abuse Prevention / Moderation / Compliance

## 13) Abuse Prevention
- Current: Rate limiting exists for auth endpoints only; no global abuse policy found.
- Evidence:
  - `src/lib/rate-limit.ts`

## 14) Content Moderation
- Current: No content moderation subsystem detected.
- Evidence:
  - Repo scan of APIs/features did not reveal moderation logic.

## 15) Compliance Hints
- Current: Supabase RLS enablement migration/script exists, indicating a security hardening intent.
- Evidence:
  - `prisma/migrations/20260127120000_enable_rls_public/migration.sql`
  - `prisma/rls_enable_public.sql`

## 16) Production Deployment Topology
- Policy: Vercel is the only production deployment target. Docker is limited to local smoke and integration testing.
- Enforcement:
  - `vercel.json`
  - `docs/DECISIONS/deployment.md`
  - `docs/DEPLOYMENT.md`
  - `docker-compose.local.yml`
  - `src/proxy.ts`
- Gaps/TODOs:
  - No formal production Docker support should be added back without an explicit architecture decision.
  - Next.js middleware has been migrated to the `proxy` convention in source, but if upstream tooling changes again the route gate should be rechecked.

## Evidence (Commit-Level)
- `1a16a42` - auth/data endpoint hardening and rate-limit enhancements.
- `8df24b4` - header hardening, sanitization extraction, stricter cron auth.
- `9702602` - notifications + cron policy surfaces.
- `70fb9fe` - payment import audit model/policies.

## Uncertainty
- No standalone legal/compliance policy documents were found (privacy policy, retention policy, DPIA, etc.).
- Production log redaction policy is not formally documented in-repo.
