# Feature Landscape

**Domain:** Fitness studio operations platform modernization
**Researched:** 2026-04-07
**Scope:** Brownfield improvement categories for making the existing app feel production-grade without expanding into a new product line
**Overall confidence:** MEDIUM-HIGH

## Framing

This is not a greenfield feature ideation exercise. The app already covers members, scheduling, training, payments, notifications, and onboarding. The question is which improvement categories are now expected for a production-grade studio-management product, which additions would create real leverage after the core is reliable, and which tempting expansions should be blocked.

Current market signals are consistent: studio software is expected to unify member records, booking, payments, reminders, attendance, reporting, and self-service. Current vendor positioning from Capterra, Zen Planner, Vagaro, and WellnessLiving treats those capabilities as baseline, not premium. For this repo specifically, the gap is less "missing modules" and more "existing modules do not yet behave with enough operational trust."

## Table Stakes

Features users and operators now expect. Missing these makes the app feel fragile even if the surface area already exists.

| Improvement Category | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Core workflow correctness and idempotency | Studio staff expect bookings, recurring schedule updates, reminders, and billing jobs to be correct every time. Duplicate sends, silent drops, and wrong "future" edits break trust immediately. | High | First priority. This directly maps to current cron overlap, scheduler retry gaps, recurring edit semantics, and dashboard correctness issues already identified in the repo reviews. |
| Reliable self-service booking and schedule visibility | Members expect to book, reschedule, cancel, and view upcoming sessions without staff intervention, and staff expect capacity views to be accurate. | High | The app already has booking surfaces; the work is to make availability, next-class calculations, cancellation semantics, and recurring behavior consistent before adding new booking modes. |
| Billing operations that are predictable and auditable | Payment history, due-state transitions, reminders, receipts, and import/reconciliation behavior are table stakes in current fitness software. | High | Build on the existing payments subsystem and strong import lineage. Prioritize retry-safe reminder delivery, clearer payment state, and operator-visible failure handling before adding growth monetization features. |
| Notification delivery you can trust | Automated reminders, verification emails, and operational messages are expected, but only if failures are visible and replayable. | High | Today the app already sends email and WhatsApp, so the missing table stake is delivery reliability: durable retry semantics, dedupe policy, channel status, and operator replay rather than adding more channels. |
| Complete member lifecycle state | Production apps are expected to show whether a member is fully onboarded, verified, profile-complete, health-form complete, and payment-ready. | Medium | The app already has onboarding and anamnesis flows. The gap is making completion state explicit, recoverable, and operator-friendly instead of hiding it across routes and token flows. |
| Staff permissions and audit safety rails | As soon as a studio has more than one operator, coarse admin/member roles stop feeling production-grade. Staff need scoped access and change traceability. | Medium-High | Do not overbuild enterprise RBAC. Add role/permission slices around finance, member management, scheduling, and notifications, plus audit history for sensitive mutations. |
| Operational visibility and recovery tooling | Production apps need health checks, actionable dashboards, job run summaries, and a way to inspect or replay failed work. | Medium-High | This is table stakes for a live ops product, not "nice to have." It is the difference between a system that works and a system operators can run. |
| Performance and consistency on core screens | Dashboards, schedule views, member lists, and finance pages must stay fast and accurate under realistic data volume. | Medium | This is not a vanity optimization pass. Slow or inconsistent agenda/finance dashboards make the product feel unfinished even if features exist. |

## Differentiators

Useful improvements after the table stakes above are stable. These can improve retention, operator efficiency, or commercial value without changing the product's core shape.

| Differentiator | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Waitlist and fill-from-cancellation automation | Studios with limited capacity get immediate value from backfilling canceled spots and reducing manual coordination. | Medium-High | Worth doing only after schedule correctness is fixed. The repo currently shows no waitlist model, so this is a genuine product addition, not a quick patch. |
| No-show and attendance policy automation | Automatic attendance states, no-show marking, and policy-driven follow-ups improve retention and class utilization. | Medium | The app already exposes `presente` data, which makes this adjacent to existing flows rather than a greenfield domain. |
| Retention and at-risk member insights | Flagging members who stop attending, miss payments, or stall onboarding gives operators a concrete intervention queue. | Medium | Strong differentiator because it uses data the app already owns. Safer than launching a full CRM because it stays tied to operational workflows. |
| Operator workflow acceleration | Bulk actions, saved filters, faster finance triage, reusable message templates, and better schedule-side quick actions reduce staff time per task. | Medium | This is a high-leverage modernization track once correctness is stable, especially given the large finance page and route/service boundary issues. |
| Preference-aware communication center | A unified history of reminders, payment messages, and onboarding nudges with channel preference handling can make the app feel meaningfully better than basic studio tools. | Medium-High | Only useful after notification reliability is fixed. Avoid turning this into a full marketing suite. |
| Better training continuity for members | Cleaner training history, versioned plan updates, and better member-facing training access can improve perceived premium quality. | Medium | Fits the current product because training already exists. Keep it focused on continuity and clarity, not on becoming a workout-tracking platform. |

## Anti-Features

Features to explicitly NOT build in this milestone range. These are the main scope-drift risks for a brownfield production-hardening effort.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Multi-location or franchise management | The current app and roadmap are for one studio operation. Multi-entity permissions, reporting, billing, and scheduling would explode complexity across every core domain. | Keep all hardening assumptions single-location until the current product is reliably production-grade. |
| Full CRM and marketing automation suite | Lead funnels, campaign builders, landing pages, and promo orchestration are separate product lines. They would pull effort away from reliable booking, billing, and notifications. | Limit communication improvements to operational nudges, payment reminders, onboarding recovery, and retention signals tied to existing members. |
| Native mobile apps or a mobile rewrite | The current problem is trust and maintainability, not platform reach. A native app multiplies surface area before the web flows are hardened. | Improve responsive web self-service and reduce friction in current member/admin flows. |
| Retail, POS hardware, and inventory expansion | This app is about studio operations, not becoming a retail stack. Inventory, checkout hardware, and merchandising add a new operational domain. | Keep payments focused on memberships, sessions, packages, and reconciliation. |
| Payroll, commissions, or full HR management | Staff scheduling and payroll are common upsell modules in the market, but they are outside this app's current core value and data model. | Add only the minimum permissioning and audit controls needed for current operators. |
| Wearables, device sync, or workout telemetry | Device ecosystems are integration-heavy and not required to make this app production-grade for studio operations. | Improve training plan clarity and member access using current training features. |
| Community feed, challenges, gamification, or loyalty programs | These can drive engagement, but they do not solve the current trust, correctness, and operator-efficiency gaps. | Revisit only after retention insights and attendance reliability are already strong. |
| AI copilot features | AI summaries, AI scheduling help, or AI messaging are distraction risk at this stage. They add cost and failure modes before the base workflows are dependable. | Use deterministic workflow cleanup, operator queues, and better reporting first. |
| Architecture rewrite or service extraction beyond need | Rewrites and premature microservice decomposition solve the wrong problem for a small studio monolith. | Refactor boundaries inside the monolith so services own business rules and routes stay thin. |

## Feature Dependencies

```text
Core workflow correctness/idempotency -> Notification reliability
Core workflow correctness/idempotency -> Reliable self-service booking
Reliable self-service booking -> Waitlist automation
Billing predictability/auditability -> Retention insights
Notification reliability -> Preference-aware communication center
Complete member lifecycle state -> Retention insights
Staff permissions/audit safety -> Operator workflow acceleration
Operational visibility/recovery tooling -> Safe rollout of every automation above
```

## Sequencing Implications

1. Fix trust first.
   Correctness, idempotency, and observability should come before any new member-facing automation. The current app already has enough surface area to feel broken if core flows remain inconsistent.

2. Harden the operational loop next.
   Billing reliability, notification replay, and explicit lifecycle state should be the second tranche because they reduce manual cleanup and customer-facing failures.

3. Improve staff efficiency after the system is trustworthy.
   Faster finance, saved filters, bulk actions, and better recovery tooling pay off once operators can rely on the underlying data.

4. Add carefully chosen differentiators last.
   Waitlists, retention queues, and communication enhancements are valuable, but only once the core booking and reminder flows stop producing ambiguity.

## MVP Recommendation

Prioritize:
1. Core workflow correctness and idempotency
2. Billing and notification reliability with operator replay visibility
3. Reliable self-service booking plus explicit member lifecycle state
4. Staff permissions, audit safety, and operational dashboards

Defer:
- Waitlist automation: high value, but it sits on top of schedule correctness and cancellation semantics that are not stable enough yet.
- Retention insights: good use of existing data, but only after attendance, payment, and onboarding states are clean.
- Training continuity upgrades: useful, but lower leverage than schedule/billing hardening for this milestone.

## Brownfield Call

For this app, "production-grade" mostly means making existing domains dependable, inspectable, and recoverable. The winning roadmap is not "more modules." It is:

- fewer silent failures
- fewer duplicated policies
- clearer operator state
- safer automation
- faster core admin/member flows

If a proposed improvement does not strengthen one of those five outcomes, it is probably a distraction for this milestone.

## Sources

**Project evidence**
- `.planning/PROJECT.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/CONCERNS.md`
- `.planning/codebase/TESTING.md`
- `ARCHITECTURE_REVIEW.md`
- `PROJECT_REVIEW.md`

**Market and ecosystem evidence**
- Capterra Fitness Software buyer guide and feature taxonomy: https://www.capterra.com/fitness-software/ (updated 2026-02-05)
- Zen Planner fitness software automations/features: https://zenplanner.com/product/fitness-software-automations/
- Vagaro feature list and pricing page: https://www.vagaro.com/pro/pricing
- Vagaro access levels and employee permissions: https://support.vagaro.com/hc/en-us/articles/18977275541531-Configure-Access-Levels-and-Employee-Permissions (updated 2026-03-02)
- WellnessLiving client booking and waitlist behavior: https://help.wellnessliving.com/en/articles/9834437-book-an-appointment-as-a-client
- WellnessLiving forms/settings and completion requirements: https://help.wellnessliving.com/en/articles/9976935-forms-settings

## Confidence Notes

- **Table stakes:** HIGH confidence. Supported by both repo evidence and multiple current market sources.
- **Differentiators:** MEDIUM confidence. Strong fit for this product, but business priority should still be validated with studio operators.
- **Anti-features:** HIGH confidence for this milestone because they directly protect the stated brownfield hardening scope in `.planning/PROJECT.md`.
