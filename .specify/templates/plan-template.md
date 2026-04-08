# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]
**Observability / Operations**: [logs, metrics, tracing, alerts, runbooks or NEEDS CLARIFICATION]
**Migration / Backfill**: [schema/data migration needs, backfills, repair scripts or N/A]
**Runtime Contract Impact**: [health checks, cron behavior, env vars, external providers, docs impact]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [ ] Domain logic is owned by explicit services/queries; pages, routes, and actions stay thin
- [ ] Read paths remain side-effect free, or the plan includes explicit justification, tests, and
      documentation for any exception
- [ ] Idempotency, retry, concurrency, and failure handling are defined for runtime-sensitive flows
- [ ] Observability and operational contract changes are identified, including logging, alerts, env,
      cron, health-check, and provider impacts
- [ ] Verification is proportional to risk; auth, scheduling, payments, notifications, jobs,
      migrations, and runtime contracts have integration-level coverage where appropriate
- [ ] Documentation and decision records impacted by this feature are identified

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (admin)/
│   ├── (aluno)/
│   ├── (auth)/
│   ├── actions/
│   └── api/
├── components/
├── hooks/
├── services/
└── lib/

prisma/
src/__tests__/
docs/
```

**Structure Decision**: Keep the existing modular monolith. New work should prefer `src/services/`
for business rules, `src/lib/` for infrastructure adapters and shared helpers, `src/app/` for thin
route or page entrypoints, and `src/__tests__/` for automated verification.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
