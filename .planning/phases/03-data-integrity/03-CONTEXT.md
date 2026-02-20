# Phase 3: Data Integrity - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 must make anamnese field handling and email-missing behavior consistent from a single source of truth, including legacy data cleanup where required.

</domain>

<decisions>
## Implementation Decisions

### Canonical Anamnese Field Behavior
- New canonical anamnese fields must auto-propagate everywhere.
- Unknown anamnese keys in payloads should be ignored silently.
- Missing known anamnese fields should default to `null`.
- When a canonical field is removed, legacy values should be migrated/cleaned up in this phase.

### Email-Missing Behavior (No Placeholder Strategy)
- Do not use placeholder email generation. If there is no email, it remains missing (`null`).
- Existing placeholder emails should be migrated to `null` in this phase.
- Member create/update should accept missing email (`null`) as valid.
- Email-dependent flows should be blocked until email is provided.

### Legacy/Inconsistent Data Handling
- Read APIs should auto-normalize malformed legacy anamnese data to canonical shape.
- Normalized data should be persisted back to DB (self-healing behavior).
- Placeholder-email migration should pre-validate all records and migrate only the safe set.
- Include a deterministic one-time migration script plus output/report artifact in this phase.

### Error and Fallback Behavior
- If normalization fails unexpectedly, fail request with clear integrity error.
- Migration execution should be transactional fail-fast (all-or-nothing).
- Post-phase payload validation should be tolerant on read/write with warnings.
- Client-facing error responses should remain generic (no technical internals).

### Claude's Discretion
- Naming and placement of migration/report artifacts in repository structure.
- Warning transport format details (log-only vs response metadata), as long as generic client error messaging is preserved.

</decisions>

<specifics>
## Specific Ideas

- The user explicitly wants to remove placeholder-email behavior rather than centralize a placeholder generator.
- Legacy cleanup is expected as part of this phase, not deferred.
- Data integrity work should actively self-heal persisted malformed records where possible.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-data-integrity*
*Context gathered: 2026-02-20*
