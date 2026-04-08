<!--
Sync Impact Report
Version change: template -> 1.0.0
Modified principles:
- Template principle 1 -> I. Service-Owned Domain Logic
- Template principle 2 -> II. Correctness and Idempotency Before Expansion
- Template principle 3 -> III. Observability and Operational Contracts
- Template principle 4 -> IV. Risk-Based Verification
- Template principle 5 -> V. Incremental Simplicity and Measured Performance
Added sections:
- Engineering Standards
- Delivery Workflow and Quality Gates
Removed sections:
- None
Templates requiring updates:
- ✅ .specify/templates/plan-template.md
- ✅ .specify/templates/spec-template.md
- ✅ .specify/templates/tasks-template.md
- ⚠ pending .specify/templates/commands/ (directory not present in this repo)
Follow-up TODOs:
- None
-->
# Gabi Rego Studio Constitution

## Core Principles

### I. Service-Owned Domain Logic
Business rules, state transitions, retry semantics, and multi-step mutations MUST live in
server-side service or query modules. `src/app/**` pages, API routes, and server actions MUST stay
thin and are limited to auth, validation, transport mapping, and presentation concerns. Client
components, hooks, and UI-only helpers MUST NOT access Prisma directly or define domain policy.

Rationale: this repo is already a brownfield monolith with boundary leaks; production-grade
maintainability depends on one clear owner for domain behavior.

### II. Correctness and Idempotency Before Expansion
Changes to auth, onboarding, scheduling, payments, notifications, lifecycle state, cron execution,
or any customer-visible operational workflow MUST define correct behavior for retries, concurrency,
scope, and failure handling before new feature expansion is approved. Read-only or `GET`-style
flows MUST NOT mutate durable state unless the behavior is explicitly documented, justified, and
covered by tests.

Rationale: trust-critical studio operations fail from subtle correctness defects long before they
fail from missing v2 features.

### III. Observability and Operational Contracts
Every new or materially changed runtime path MUST emit structured logs with enough context to trace
the request or job through downstream effects. Health checks, cron routes, deployment assumptions,
provider integrations, and environment requirements MUST have an explicit operational contract and
that contract MUST stay aligned across code, configuration, and documentation.

Rationale: brownfield hardening without visibility creates false confidence and slow incident
response.

### IV. Risk-Based Verification
Every change MUST include verification proportional to its risk. Changes touching auth, scheduling,
payments, notifications, background jobs, data migrations, or cross-cutting runtime behavior MUST
include automated tests at the highest sensible level; unit tests alone are insufficient when
integration behavior is the risk. Low-risk presentational changes MAY use lighter verification only
when they do not alter behavior or runtime contracts.

Rationale: the repo already has meaningful tests, but production-grade confidence requires stronger
coverage where customer trust or operational safety is at stake.

### V. Incremental Simplicity and Measured Performance
The system MUST evolve as a modular monolith unless an explicit architecture decision proves
otherwise. Rewrites, microservice splits, secondary API layers, and speculative abstractions are
prohibited without a documented decision and measurable justification. Performance work MUST target
measured hotspots with explicit success criteria instead of intuition or cargo-cult optimization.

Rationale: this project needs disciplined improvement, not architecture churn.

## Engineering Standards

- The supported application shape is a Next.js monolith on Vercel backed by Prisma and PostgreSQL.
  Framework replacement, microservice extraction, or additional transport layers such as GraphQL,
  tRPC, or a second client data cache require a documented architecture decision in `docs/DECISIONS/`.
- Timezone and date policy for scheduling, reminders, billing, and lifecycle flows MUST be
  centralized in shared helpers or services. New ad hoc date math is prohibited in trust-critical
  flows when a shared policy already exists or should exist.
- Direct Prisma access from server pages is treated as transitional debt. New repeated page-local
  reads MUST be extracted toward service or query boundaries instead of expanding that pattern.
- Runtime configuration MUST fail fast when critical environment variables or deployment assumptions
  are invalid.
- Security-sensitive links, tokens, and callbacks MUST derive from explicit canonical application
  configuration and MUST fail closed rather than silently falling back to unsafe defaults.

## Delivery Workflow and Quality Gates

- `speckit` feature specs, plans, and tasks MUST pass a constitution check before implementation.
- Feature specs for brownfield or runtime-sensitive work MUST cover operational impact, failure
  handling, access control or audit impact, observability, and documentation or runbook updates.
- Plans MUST identify which files own domain logic, which runtime contracts change, what tests are
  required, and how idempotency or side effects are controlled.
- Tasks MUST include observability, testing, and documentation work whenever runtime contracts or
  trust-critical behavior change.
- Pull requests target `main` only and SHOULD keep one primary objective per branch, matching
  `docs/WORKFLOW.md`.
- Before merge, changes MUST pass `npm run lint`, `npm run test:run`, and `npm run build`. Schema
  changes MUST also pass `npm run db:migrate:deploy` or an equivalent migration validation.
- Documentation MUST be updated whenever code changes a route contract, cron behavior, deployment
  assumption, environment requirement, or operator workflow.
- Architecture or runtime-contract changes MUST record rationale in `docs/DECISIONS/` before they
  become institutionalized debt.

## Governance

This constitution supersedes ad hoc project habits when there is conflict. Every plan, review, and
implementation affecting runtime behavior MUST be checked against these principles. Amendments
require:

1. A written rationale describing what changed and why.
2. Synchronized updates to dependent SpecKit templates and any affected workflow or deployment docs.
3. A semantic version bump according to impact:
   - MAJOR for incompatible principle changes or removals.
   - MINOR for new principles, sections, or materially expanded requirements.
   - PATCH for clarifications that do not change meaning.
4. Review that existing active plans and roadmap phases still comply or are explicitly updated.

Compliance review expectations:
- Constitution compliance is part of planning, code review, and roadmap updates.
- A change that violates a principle without an explicit documented exception is incomplete.
- Complexity must be justified with measurable need, not preference.

**Version**: 1.0.0 | **Ratified**: 2026-04-07 | **Last Amended**: 2026-04-07
