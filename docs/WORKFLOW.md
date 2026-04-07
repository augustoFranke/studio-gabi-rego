# WORKFLOW

## Branch Policy
- `main` is the only long-lived branch.
- Use short-lived branches only.
- Retire `fixes` as a permanent integration branch; any remaining history should be merged into `main` and the branch deleted.
- Preferred prefixes:
  - `feat/<slug>`
  - `fix/<slug>`
  - `refactor/<slug>`
  - `ops/<slug>`
  - `chore/<slug>`
  - `docs/<slug>`
  - `test/<slug>`
- Keep each branch scoped to one primary objective.

## Pull Request Policy
- Open PRs into `main` only.
- Use squash merge by default.
- Use a conventional title prefix such as `feat:`, `fix:`, `refactor:`, `ops:`, `chore:`, `docs:`, or `test:`.
- Include problem, change summary, risk, validation, and migration or env impact in the PR description.
- Prefer one subsystem per PR, especially for backend service extraction.

## Required Validation
- Run `npm run lint`.
- Run `npm run test:run`.
- Run `npm run build`.
- Run `npm run db:migrate:deploy` or the equivalent migration check when schema changes are involved.

## Local Docker Use
- Use `docker-compose.local.yml` for local smoke or integration checks only.
- Do not treat Docker as a supported production hosting path.

## Repo Discipline
- Avoid mixing product behavior changes with repo workflow or documentation changes in the same branch unless one depends on the other.
- Update docs when a route, contract, or runtime assumption changes.

## GitHub Admin Tasks
- Set `main` as the default branch.
- Require pull requests and at least one approving review for `main`.
- Require passing CI checks before merge.
- Dismiss stale approvals on new commits.
- Disable direct pushes to `main`.
- Keep `.github/CODEOWNERS` and `.github/PULL_REQUEST_TEMPLATE.md` in sync with repo policy.
