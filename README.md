# Workforce Platform

A modular workforce-management SaaS for small businesses with hourly employees, departments, crews, locations, and eventually field jobs.

The product is designed to start simple: help a small business replace paper, spreadsheets, and schedule-related text messages with one reliable system. Later modules can add labor intelligence, crews, jobs, GPS/field workflows, messaging, and AI-assisted scheduling without turning the core into one tightly coupled application.

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

**Gate 4 — Time Tracking**

The current implementation includes:

- Gate 0 workforce core and tenant isolation
- Gate 1 weekly scheduling, publishing, and My Schedule
- Recurring employee availability with effective dates
- Employee time-off requests and cancellation
- Manager approval and denial
- Availability and approved-time-off scheduling warnings with explicit override
- Published shifts that managers can mark open without rebuilding the schedule
- Employee open-shift requests with manager approval or denial
- Employee shift-swap requests with manager approval or denial
- Atomic, stale-safe assignment changes through the Scheduling service
- Employee clock-in, break, and clock-out workflows with duplicate-transition protection
- Nullable links from actual time entries to assigned published shifts without changing scheduled time
- Read-only employee weekly timesheets with gross, break, net, daily, and weekly calculations
- Manager weekly time review, auditable corrections, and per-entry approval state
- Tenant-scoped time-entry and break RLS with authoritative transactional operations

Gate 5 labor intelligence and all later modules remain out of scope.

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

### Gate 3 local verification

Gate 3 and all prior gates were verified against the local Supabase stack on August 21, 2026:

- `pnpm db:reset` passed.
- `pnpm test:db` passed with all 142 Gate 0–3 security assertions passing.
- `pnpm test` passed with all 26 unit tests passing.
- `pnpm test:e2e` passed with all four Gate 0–3 workflows passing.
- TypeScript, ESLint, and the production build passed.
- The Gate 3 multi-user workflow covered publish → mark open → employee request →
  manager approval → My Schedule → swap request → availability warning → explicit
  manager override → reassignment to a distinct employee account.

Gate 3 eligibility intentionally stays small: requesters and swap targets must be
active employees in the same organization, and shifts must be in the required
published/open state. A richer qualification matrix is future work; Gate 3 does
not introduce a new qualification or marketplace subsystem.

Eligible employees discover newly opened coverage on the authenticated Open
Shifts page, and the existing audit stream records the shift state change.
Outbound email, push, or SMS delivery remains part of the later notifications
expansion rather than Gate 3.

### Gate 4 local verification

Gate 4 and all prior gates were verified against the local Supabase stack on August 22, 2026:

- `pnpm db:reset` passed.
- `pnpm test:db` passed with all 200 Gate 0–4 security assertions passing.
- `pnpm test` passed with all 37 unit tests passing, including elapsed-time and DST coverage.
- `pnpm test:e2e` passed with all five Gate 0–4 workflows passing.
- TypeScript, ESLint, and the production build passed.
- The Gate 4 multi-user workflow covered published shift → employee clock-in → break
  start/end → clock-out → My Timesheet → manager correction → manager approval →
  corrected employee view.

Scheduled shifts remain the planning record. Actual timestamps and breaks are stored
separately, with nullable shift linkage available for scheduled-versus-actual comparison
by a later labor module. Gate 4 does not calculate payroll, overtime pay, or labor cost.

## Status

Gate 4 — Time Tracking is implemented and fully verified locally. Gate 0–3 regression
suites remain green. Labor intelligence and all Gate 5+ behavior remain out of scope.
