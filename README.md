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

## Status

Architecture established. Application implementation has not started yet.
