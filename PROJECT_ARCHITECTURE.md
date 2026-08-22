# Workforce Platform — Project Architecture

## Purpose

This repository is the modular foundation for a small-business workforce management SaaS. The product should begin with scheduling and employee self-service, then expand through independent modules such as time tracking, labor intelligence, crews, jobs, GPS/field operations, messaging, and AI-assisted scheduling.

The architectural principle is simple:

> The core owns identity and shared business data. Feature modules own their own domain logic. Modules communicate through defined services and contracts instead of reaching directly into one another.

## Technology Baseline

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase Auth
- PostgreSQL / Supabase Database
- Row Level Security (RLS)
- Supabase Realtime where useful
- Vercel deployment
- Playwright for end-to-end workflows

## Core Platform Responsibilities

The core is Module 0 and must be stable before feature development begins.

The core owns:

- Authentication
- User profiles
- Organizations
- Organization memberships
- Employees
- Locations
- Departments
- Roles and permissions
- Organization settings
- Module registry
- Notifications infrastructure
- Audit events

## User vs. Employee

A user is a login identity.
An employee is a person who works for an organization.

These are not the same concept.

An employee may exist before receiving login access. An owner, accountant, or administrator may have platform access without being represented as a normal employee.

## Multi-Tenant Requirement

Every organization-owned record must be scoped to an `organization_id` unless there is a documented reason not to do so.

Tenant isolation must be enforced at the database level using RLS. UI checks alone are not sufficient.

Required security behavior:

- Organization A cannot read Organization B rows.
- Organization A cannot update Organization B rows.
- Organization A cannot delete Organization B rows.
- Direct requests using another tenant's known IDs must still fail.

## Suggested Core Tables

### organizations

- id
- name
- slug
- timezone
- created_at
- updated_at

### profiles

- id
- auth_user_id
- first_name
- last_name
- phone
- created_at

### organization_memberships

- id
- organization_id
- profile_id
- membership_role
- status
- created_at

### employees

- id
- organization_id
- profile_id nullable
- employee_number
- first_name
- last_name
- email
- phone
- employment_status
- hire_date
- hourly_rate nullable
- created_at
- updated_at

### locations

- id
- organization_id
- name
- address
- city
- state
- postal_code
- latitude nullable
- longitude nullable
- active

### departments

- id
- organization_id
- location_id nullable
- name
- active

### roles

- id
- organization_id
- name
- description

### employee_roles

- id
- organization_id
- employee_id
- role_id

### organization_modules

- id
- organization_id
- module_key
- enabled
- settings_json
- created_at
- updated_at

## Permission Model

Do not spread role-name checks throughout the app. Prefer capabilities.

Examples:

- employee.view
- employee.manage
- schedule.view
- schedule.manage
- schedule.publish
- timeoff.request
- timeoff.approve
- timeclock.use
- timeclock.edit
- labor.view_summary
- labor.view_wages
- labor.manage_wages
- settings.manage

Initial role examples:

### Owner
All capabilities.

### Manager
Operational employee and schedule permissions without unrestricted owner/settings authority.

### Employee
Self-service permissions only.

## Module Boundaries

### Module 1 — Scheduling
Owns schedules, shifts, publishing, assignments, and scheduling domain rules.

### Module 2 — Availability
Owns employee recurring availability and effective date ranges. Scheduling may read availability but availability does not directly modify shifts.

### Module 3 — Time Off
Owns time-off requests and approvals. Scheduling may query approved time off but the time-off module does not rewrite schedules directly.

### Module 4 — Open Shifts
Depends on Scheduling. Employees may request open shifts; approved assignments must be performed through the scheduling service.

### Module 5 — Shift Swaps
Depends on Scheduling. Approved swaps must be performed through the scheduling service.

### Module 6 — Time Clock
Owns clock-in, clock-out, breaks, time entries, corrections, and approval state.

### Module 7 — Labor
Reads employee wage, schedule, and time-clock data to calculate scheduled and actual labor cost. It should not control those source modules.

### Module 8 — Notifications
Provides shared event-to-notification delivery. Feature modules emit events rather than embedding email/SMS logic in each feature.

### Module 9 — Crews
Owns crews and crew membership.

### Module 10 — Jobs
Owns jobs and crew/employee job assignments.

### Module 11 — GPS / Field
Uses time clock and job location data to enforce optional field rules such as clock-in radius.

Gate 7 implements this boundary as an optional field-clock policy plus immutable attempt evidence.
The browser requests one location reading only after an employee presses the verification button.
The database revalidates tenant, employee, permission, assignment, job status, coordinates, radius,
and device accuracy; PostgreSQL calculates Haversine distance and decides the outcome.

Verified and not-required attempts can call the shared protected Gate 4 clock-in primitive. An
outside-radius or low-accuracy result records evidence but creates no time entry. A permitted manager
may override a failed result with a required reason; the original result remains stored, and the same
employee must explicitly consume the approved override while the job remains eligible. An override
cannot be replayed.

GPS / Field does not own shifts, jobs, assignments, time-entry correction, labor calculation, or
notifications. It does not collect continuous/background location, location history, routes, or a
live map.

### Module 12 — AI Scheduling
Produces suggestions only. AI must not write directly to production scheduling tables. Proposed schedules must pass normal validation and manager approval.

## Scheduling Service Boundary

All assignment mutations must pass through a defined scheduling service/action layer.

Examples:

- assignEmployeeToShift()
- removeEmployeeFromShift()
- publishSchedule()
- openShift()
- cancelShift()

Open Shifts, Shift Swaps, manager scheduling UI, and future AI scheduling should all use the same authoritative mutation path.

## Scheduled Time vs. Actual Time

Schedule data and time-clock data are separate records.

Do not overwrite scheduled shifts with actual punches.

Example:

- Scheduled: 8:00 AM–5:00 PM
- Actual: 8:07 AM–5:14 PM

The difference is valuable business data and must be preserved.

## Notifications Architecture

Modules should emit domain events such as:

- schedule.published
- shift.changed
- shift.opened
- timeoff.requested
- timeoff.approved
- swap.requested
- swap.approved

The notifications system decides how those events are delivered through in-app, email, push, or later SMS channels.

## Folder Structure Target

```text
src/
  app/
    (auth)/
    (dashboard)/
    api/

  core/
    auth/
    organizations/
    employees/
    locations/
    departments/
    permissions/
    notifications/
    modules/

  modules/
    scheduling/
      components/
      actions/
      queries/
      types/
      validation/
      tests/
    availability/
    time-off/
    open-shifts/
    shift-swaps/
    time-clock/
    labor/
    messaging/
    crews/
    jobs/
    field-clock/
    ai-scheduling/

  components/
    shared/

  lib/
    supabase/
    dates/
    validation/

  types/
```

## Dependency Direction

```text
CORE
 ├─ Employees
 ├─ Locations
 ├─ Departments
 └─ Permissions
       │
       ▼
   Scheduling
    ├─ Availability
    ├─ Time Off
    ├─ Open Shifts
    └─ Shift Swaps
       │
       ▼
   Time Clock
       │
       ▼
      Labor

CORE → Crews → Jobs → GPS / Field

Scheduling + Availability + Labor + related constraints → AI Scheduling
```

## Version 1 Scope

Version 1 should include only:

- Core platform
- Employees
- Locations
- Departments
- Permissions
- Weekly scheduling
- Shift create/edit/delete/assign
- Schedule publish
- Employee "My Schedule"
- Availability
- Time-off requests and approval
- Open shifts

Not Version 1:

- Payroll processing
- Benefits
- Recruiting
- Tax filing
- Advanced HR
- GPS
- AI scheduling
- Complex labor forecasting
- Large reporting suite

## First Product Success Test

The first meaningful product milestone is:

> Can a 10–25 employee business stop using a paper or spreadsheet schedule and successfully run next week's schedule entirely through this platform?

If yes, Version 1 has achieved its purpose.
