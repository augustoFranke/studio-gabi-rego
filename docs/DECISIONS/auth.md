# Authentication And Session Strategy

## Status
Observed

## Context
The app must support member and admin access from the same codebase, protect route groups, and allow API ownership checks without server-side session table lookups on every request.

## Decision
Use NextAuth credentials login with JWT sessions, then enforce role boundaries in the route proxy (`route access`) and API wrappers (`action access`).
Onboarding and profile completion now use dedicated service modules and token namespaces so verification, profile completion, and anamnese completion are orchestrated consistently.

## Alternatives Considered (Inferable)
- DB-backed sessions for immediate revocation.
- Third-party identity provider flow.
- Route-only auth without API-level guard wrapper.

## Consequences
Pros:
- Stateless session checks scale well in serverless/runtime contexts.
- Shared auth primitives across pages and APIs.
- Ownership helper centralizes member-vs-admin checks.

Cons:
- JWT revocation is less immediate than stateful sessions.
- Role model is currently coarse (`ADMIN`/`MEMBRO`).

## Impacted Areas
- `src/lib/auth.ts`
- `src/proxy.ts`
- `src/lib/api.ts`
- `src/services/perfil.service.ts`
- `src/services/membro.service.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/api/auth/cadastro/route.ts`
- `src/app/api/auth/verificar-email/route.ts`
- `src/app/api/membros/[id]/perfil-link/route.ts`
- `src/app/api/**` routes using `withApiAuth`

## Evidence
Files:
- `src/lib/auth.ts` (Credentials provider, JWT/session callbacks)
- `src/proxy.ts` (route-role mapping)
- `src/lib/api.ts` (`withApiAuth`, `ensureOwnerOrAdmin`)
- `src/types/next-auth.d.ts` (session/JWT role fields)

Commits:
- `a0e14a9` - migrated to canonical Next.js route proxy entrypoint.
- `1a16a42` - hardened auth/data endpoints.
- `dfe494b` - onboarding/auth flow reshaping around registration + verification.
