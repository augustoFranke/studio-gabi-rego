# Cleanup Skill Discovery

Date: 2026-04-29

The cleanup plan required a broad skill search before refactoring. The local
`find-skills` workflow was used through `npx skills find`.

## Installed And Used

- `vercel/nextjs-skills@next-best-practices`
  - Source: Vercel
  - Reason: Next.js App Router, route handler, RSC boundary, and build guidance.
  - Skills.sh: https://skills.sh/vercel/nextjs-skills/next-best-practices
- `getsentry/skills@security-review`
  - Source: Sentry
  - Reason: systematic security review guidance focused on exploitable findings.
  - Skills.sh: https://skills.sh/getsentry/skills/security-review

## Already Available Locally

- `vercel-react-best-practices`
- `security-best-practices`
- `playwright`
- `web-design-guidelines`

## Searched But Not Installed

- `react refactor`: results were low-adoption or React Native specific.
- `typescript clean architecture`: results were low-adoption or NestJS specific.
- `playwright e2e`: the best result had adoption, but the repo already has
  Playwright installed and a local Playwright skill.
- `prisma performance`: results were below the adoption threshold or from
  less-established sources.
