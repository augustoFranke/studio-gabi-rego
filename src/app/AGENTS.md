# Agent Instructions: /src/app (Next.js App Router)

# AGENTS.md — src/app

This directory contains UI routes and API routes.

---

## BEFORE WRITING CODE

- Decide: UI or API?
- If API, read `src/app/api/AGENTS.md`.

---

## UI RULES

- Components should mostly render and delegate.
- Complex state transitions belong in pure functions.
- Avoid spreading logic across many `useState`s.
- Prefer explicit, readable state over clever abstractions.

---

## AFTER CHANGES

- Remove unused state or props.
- Check for duplicated fetch / error handling.
- Ensure behavior is unchanged.
  equested.
