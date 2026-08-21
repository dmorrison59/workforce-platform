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

**Gate 2 — Employee Self-Service**

The current implementation includes:

- Gate 0 workforce core and tenant isolation
- Gate 1 weekly scheduling, publishing, and My Schedule
- Recurring employee availability with effective dates
- Employee time-off requests and cancellation
- Manager approval and denial
- Availability and approved-time-off scheduling warnings with explicit override

Gate 3 coverage workflows remain out of scope until explicitly started.

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

## Local development setup

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

### Gate 0 local verification

Gate 0 was fully verified against the local Supabase stack on August 20, 2026:

- Local Supabase stack started successfully.
- `pnpm db:reset` passed.
- `pnpm test:db` passed with all 18 tenant-isolation assertions passing.
- `pnpm test:e2e` passed with the owner workflow test passing 1/1.
- The Playwright workflow covered signup → organization → dashboard → location →
  department → employee.

### Gate 2 local verification

Gate 2 and all prior gates were verified against the local Supabase stack on August 21, 2026:

- `pnpm db:reset` passed.
- `pnpm test:db` passed with all 93 Gate 0–2 security assertions passing.
- `pnpm test` passed with all 18 unit tests passing.
- `pnpm test:e2e` passed with all three Gate 0–2 workflows passing.
- TypeScript, ESLint, and the production build passed.
- The Gate 2 workflow covered employee availability → time-off request → manager
  approval → scheduling warnings → explicit manager override → employee status view.

## Status

Gate 2 — Employee Self-Service is implemented and fully verified locally. Gate 0 and
Gate 1 regression suites remain green. Open shifts, shift swaps, and all Gate 3+
behavior remain out of scope until Gate 3 is explicitly started.
