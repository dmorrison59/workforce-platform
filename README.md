# Workforce Platform

A modular workforce-management SaaS for small businesses with hourly employees, departments, crews, locations, and field jobs.

The product is designed to start simple: help a small business replace paper, spreadsheets, and schedule-related text messages with one reliable system. Later modules can add GPS workflows, messaging, and AI-assisted scheduling without turning the core into one tightly coupled application.

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

**Gate 7 — GPS / Field Clock**

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
- Weekly scheduled-versus-actual labor hours with location and department filters
- Scheduled and actual labor cost using separately protected hourly compensation
- Actual-minus-scheduled hour and cost variance
- Operational near/over-40-hour overtime warnings without payroll calculations
- Missing-wage, open-time, provisional-time, unlinked-time, and missing-actual signals
- Wage-private Labor access that can show hours without querying or rendering cost data
- Tenant-scoped crews with leaders, activation state, and auditable effective-dated membership
- Tenant-scoped field jobs with customer, address, schedule, notes, and operational status
- Validated crew and direct-employee job assignments through authoritative Field Operations services
- Mobile-friendly My Jobs visibility for direct assignments and date-eligible crew membership
- Terminal completed/cancelled jobs that remain visible but are read-only
- Field jobs that remain independent from workforce shifts, actual time, and labor calculations
- Optional one-time job-site location verification for employee-initiated clock-in
- Manual job verification coordinates with configurable radius and device-accuracy limits
- Server-authoritative Haversine distance decisions for assigned scheduled/in-progress jobs
- Stored verification evidence for verified, outside-radius, low-accuracy, not-required, and overridden outcomes
- Manager review and reason-required overrides that preserve the original failure result
- Explicit employee clock-in after an approved override, using the same protected Gate 4 time-entry primitive
- Tenant-scoped employee/manager verification visibility with no continuous or background tracking

Gate 8 messaging expansion and all later modules remain out of scope.

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

Employee address autocomplete is optional. Set `GEOAPIFY_API_KEY` in the server's
uncommitted environment to enable Geoapify suggestions. The key is never sent to
the browser, and employee addresses can always be entered manually when it is not
configured or the provider is unavailable.

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
by the Labor module. Gate 4 itself does not calculate payroll, overtime pay, or labor cost.

### Gate 5 local verification

Gate 5 and all prior gates were verified against the local Supabase stack on August 22, 2026:

- `pnpm db:reset` passed.
- `pnpm test:db` passed with all 240 Gate 0–5 security assertions passing.
- `pnpm test` passed with all 50 unit tests passing.
- `pnpm test:e2e -- --workers=1` passed with all six Gate 0–5 workflows passing.
- TypeScript, ESLint, and the production build passed.
- The Gate 5 multi-user workflow covered hourly compensation → published schedule →
  employee actual time → manager correction/approval → scheduled and actual cost →
  variance → overtime warning → rendered cost restriction for a labor-hours-only user.

Labor variance consistently means `actual − scheduled`. Completed or corrected entries
that are not yet approved are included as provisional actual time and clearly flagged.
The overtime threshold is a fixed operational warning at 40 hours, with “near” beginning
at 35 hours; Gate 5 does not calculate overtime pay or jurisdiction-specific rules.

The current compensation schema stores one current hourly rate per employee. Historical
reports therefore use the current rate and may change after a wage update; Gate 5 does
not claim historical payroll-grade wage accuracy or add compensation history.

### Gate 6 local verification

Gate 6 and all prior gates were verified against the local Supabase stack on August 22, 2026:

- `pnpm db:reset` passed.
- `pnpm test:db` passed with all 305 Gate 0–6 security assertions passing.
- `pnpm test` passed with all 63 unit tests passing.
- `pnpm test:e2e -- --workers=1` passed with all seven Gate 0–6 workflows passing.
- TypeScript, ESLint, and the production build passed.
- The Gate 6 multi-user workflow covered two linked employees → crew creation → effective
  membership → scheduled job → crew assignment → crew-member visibility → unrelated-user
  denial → direct assignment → completed status visibility.

Crew membership dates are inclusive and evaluated against the job date in the organization
timezone. Inactive crews cannot receive new work, overlapping membership periods and duplicate
assignments are rejected, and all cross-tenant identifiers are revalidated at the database
boundary. Completed and cancelled jobs are terminal and read-only.

Jobs do not create or update Gate 1 shifts, Gate 4 time entries, or Gate 5 labor totals. GPS,
geofencing, routing, messaging, customer CRM, estimating, invoicing, payroll, AI, job costing,
photos, forms, and checklists remain outside Gate 6.

### Gate 7 local verification

Gate 7 and all prior gates were verified against the local Supabase stack on August 22, 2026:

- `pnpm db:start` passed with Docker Desktop running.
- `pnpm db:reset` passed with all Gate 0–7 migrations and local seed data.
- `pnpm test:db` passed with all 365 Gate 0–7 security assertions passing, including
  60 field-clock distance, eligibility, permission, RLS, tenant-isolation, failure, and override assertions.
- `pnpm test` passed with all 70 unit tests passing, including Haversine distance and field-clock input boundaries.
- `pnpm test:e2e` passed with all eight Gate 0–7 workflows passing.
- TypeScript, ESLint, the production build, and `git diff --check` passed.
- The Gate 7 workflow covered assigned field job with manual coordinates → enabled policy →
  inside-radius verified clock-in → clock-out → outside-radius rejection without a time entry →
  manager override with reason → explicit employee clock-in using the approved override.

Gate 7 collects one browser geolocation reading only after an employee presses the field clock-in
button. PostgreSQL recalculates the distance and decides the result; the browser cannot declare
itself verified. Failed attempts remain evidence records and do not create time entries. An
override preserves the initial failure, manager identity, time, and reason, and can be consumed
only once by the same employee while the assigned job remains eligible.

Device coordinates are user/device input, not cryptographic proof of presence. Gate 7 provides an
operational check and makes no anti-spoofing claim. Event evidence is retained with the tenant's
operational audit data until the organization is deleted; no travel history or extra location
samples are created, and no separate automated retention policy is introduced in this gate.

The optional policy defaults to disabled, so the standard Gate 4 office/time-clock workflow is
unchanged. Gate 7 adds no continuous tracking, background tracking, route history, live map,
routing, mileage, dispatch, messaging, payroll, or Gate 8 behavior.

## Status

Gate 7 — GPS / Field Clock is implemented and fully verified locally. Gate 0–6 regression
suites remain green. Messaging expansion and all Gate 8+ behavior remain out of scope.
