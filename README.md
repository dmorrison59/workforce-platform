# Workforce Platform

A modular workforce-management SaaS for small businesses with hourly employees, departments, crews, locations, and eventually field jobs.

The product is designed to start simple: help a small business replace paper, spreadsheets, and schedule-related text messages with one reliable system. Later modules can add time tracking, labor intelligence, crews, jobs, GPS/field workflows, messaging, and AI-assisted scheduling without turning the core into one tightly coupled application.

## Product Direction

Initial target: small businesses with roughly 5–50 employees that need better scheduling but do not want a large HR or enterprise workforce platform.

Potential customers include:

- Automotive dealerships and repair shops
- Parts and service departments
- Landscaping and lawn-care companies
- Holiday-light installers
- Contractors and field-service businesses
- Cleaning companies
- Small restaurants and retail teams
- Warehouses and delivery operations

## Architecture

The platform uses a secure multi-tenant core plus optional modules.

```text
                WORKFORCE CORE
                      │
      ┌───────────────┼───────────────┐
      │               │               │
  Scheduling       Time Clock        Crews
      │               │               │
  Availability       Labor            Jobs
  Time Off                              │
  Open Shifts                          GPS
  Shift Swaps
                      │
                Future AI
```

See [PROJECT_ARCHITECTURE.md](PROJECT_ARCHITECTURE.md) for the full architecture.

## Current Milestone

**Gate 0 — Workforce Core**

The first implementation milestone is limited to:

- Next.js / TypeScript foundation
- Supabase authentication
- Organizations
- Organization memberships
- Employees
- Locations
- Departments
- Roles and permissions
- Module registry
- Row Level Security
- Tenant-isolation tests

Scheduling must not be built until Gate 0 is complete and reviewed.

See [BUILD_ROADMAP.md](BUILD_ROADMAP.md) for milestone definitions.

## Development Rules

All coding agents and contributors should read [CODEX_RULES.md](CODEX_RULES.md) before making changes.

Key rules include:

- Work one milestone at a time
- Never bypass tenant isolation
- Never disable RLS to make a feature work
- Respect module boundaries
- Keep secrets out of Git
- Test cross-tenant access
- Preserve scheduled time separately from actual worked time
- Stop when the assigned gate is complete

## Planned Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase Auth
- PostgreSQL / Supabase Database
- Row Level Security
- Vercel
- Playwright

## First Product Success Test

The first major product question is:

> Can a 10–25 employee business stop using its current paper or spreadsheet schedule and successfully run next week's schedule entirely through this platform?

That is the benchmark for the first usable version.

## Gate 0 development setup

Prerequisites: Node.js 20+, pnpm, Docker Desktop, and the Supabase CLI.

1. Copy `.env.example` to `.env.local`.
2. Run `pnpm install`.
3. Run `pnpm db:start`, then `pnpm db:reset`.
4. Put the local Supabase API URL and anon key printed by the CLI into `.env.local`.
5. Run `pnpm dev`.

For a hosted Supabase project, apply the migration in `supabase/migrations` and use
that project's public URL and anon/publishable key. Never use a service-role key in
the web application.

Local seed data uses only fictional `.example` identities and deliberately does not
include a working login password. Use the normal sign-up workflow for a local owner.
Set `PLAYWRIGHT_TEST_PASSWORD` only in your uncommitted local environment before
running the live browser workflow.

## Verification

- `pnpm typecheck` — strict TypeScript
- `pnpm lint` — ESLint
- `pnpm test` — unit tests
- `pnpm test:db` — permanent pgTAP RLS/tenant-isolation suite (local Supabase required)
- `pnpm test:e2e` — owner onboarding and core-record browser workflow
- `pnpm build` — Vercel-compatible production build

## Status

Gate 0 — Workforce Core is implemented. Scheduling and all later-gate behavior remain
out of scope until Gate 0 is reviewed.
