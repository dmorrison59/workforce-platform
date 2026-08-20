# Workforce Platform — Build Roadmap

## Guiding Rule

Build one milestone at a time. Finish it, test it, review it, and only then begin the next milestone.

The project is modular, but dependencies still matter. The core must exist before feature modules can safely plug into it.

---

# Gate 0 — Workforce Core

## Goal

Create a secure multi-tenant SaaS foundation that all later modules can use.

## Required Features

- Next.js / TypeScript project setup
- Supabase integration
- Authentication
- User profile
- Organization creation
- Organization memberships
- Owner role
- Employees
- Locations
- Departments
- Roles / permissions
- Organization settings foundation
- Organization module registry
- Row Level Security policies
- Audit-friendly created/updated metadata

## Required Workflow

Owner signs up → creates organization → creates location → creates department → adds employee.

## Required Security Tests

- Tenant A cannot read Tenant B rows
- Tenant A cannot update Tenant B rows
- Tenant A cannot delete Tenant B rows
- Known foreign IDs do not bypass RLS
- Unauthenticated users cannot access protected business data

## Exit Criteria

All Gate 0 tests pass and no scheduling code exists yet.

STOP AND REVIEW.

---

# Gate 1 — Scheduling

## Goal

Make the product useful enough to replace a basic paper or spreadsheet schedule.

## Required Features

- Weekly schedule view
- Create shift
- Edit shift
- Delete / cancel shift
- Assign employee
- Department / location context
- Copy shift
- Copy day or week where practical
- Draft schedule state
- Publish schedule
- Employee can see published shifts only

## Critical Rules

- Draft schedules are invisible to employees
- Publishing is an explicit action
- Scheduling mutations use a shared scheduling service/action layer

## Exit Criteria

A manager can build and publish next week's schedule and an employee can see it.

STOP AND REVIEW.

---

# Gate 2 — Employee Self-Service

## Goal

Reduce schedule-related texting and manual manager administration.

## Required Features

- My Schedule
- Recurring availability
- Availability effective dates
- Time-off request
- Manager approve / decline
- Approved time off visible to scheduling validation
- Scheduling warnings for conflicts

## Exit Criteria

Employees can maintain availability and request time off without manager-side data entry.

STOP AND REVIEW.

---

# Gate 3 — Coverage

## Goal

Handle call-offs and staffing changes inside the platform.

## Required Features

- Mark shift open
- Notify eligible employees
- Employee requests open shift
- Manager approves request
- Assignment updated through scheduling service
- Shift swap request
- Manager-approved shift swap

## Exit Criteria

A manager can fill a call-off without rebuilding the schedule manually.

STOP AND REVIEW.

---

# Gate 4 — Time Tracking

## Goal

Capture actual worked time independently from scheduled time.

## Required Features

- Clock in
- Clock out
- Start break
- End break
- Time entries
- Manager corrections
- Timesheet approval state
- Scheduled vs. actual comparison

## Exit Criteria

A complete workweek can be clocked and reviewed without changing original schedule records.

STOP AND REVIEW.

---

# Gate 5 — Labor Intelligence

## Goal

Turn scheduling data into useful cost information for managers.

## Required Features

- Wage storage with restricted permissions
- Scheduled labor cost
- Actual labor cost
- Scheduled hours
- Actual hours
- Overtime warnings
- Weekly labor summary
- Basic variance reporting

## Exit Criteria

Managers can understand the labor impact of a schedule before and after the week is worked.

STOP AND REVIEW.

---

# Gate 6 — Field Workforce

## Goal

Differentiate the platform from basic employee schedulers.

## Required Features

- Crews
- Crew leaders
- Crew members
- Jobs
- Job locations
- Job assignments
- Crew-to-job assignments

## Exit Criteria

A field-service business can connect employees, crews, schedules, and jobs.

STOP AND REVIEW.

---

# Gate 7 — GPS / Field Clock

## Goal

Add optional location-aware rules for field businesses.

## Potential Features

- Job-site clock-in location
- Configurable clock-in radius
- Location verification
- Field exceptions / manager override

## Exit Criteria

Location rules are optional, permission-aware, and do not break standard office/time-clock workflows.

STOP AND REVIEW.

---

# Gate 8 — Messaging and Notifications Expansion

## Goal

Centralize employee communication without coupling business logic to delivery methods.

## Potential Features

- In-app announcements
- Employee / manager messages
- Email delivery
- Push notifications
- Optional SMS later

## Exit Criteria

Feature modules emit events and the notification layer handles delivery.

STOP AND REVIEW.

---

# Gate 9 — AI Scheduling

## Goal

Use AI to suggest schedules, not control production data directly.

## Required Guardrails

AI may propose a schedule but may not bypass:

- Employee availability
- Approved time off
- Qualification / role rules
- Overtime constraints
- Location constraints
- Permission checks
- Manager approval
- Existing scheduling service validations

## Exit Criteria

AI suggestions can be reviewed, modified, accepted, or rejected without direct autonomous database writes.

---

# Pilot Milestone

The first pilot should begin as soon as Gate 1 is stable enough for a real manager to schedule a 10–25 employee team.

Do not wait for all later modules before seeking pilot feedback.

Pilot questions should focus on:

- What are they using now?
- What takes the most time?
- What creates the most scheduling mistakes?
- What do employees complain about?
- Which feature would they pay for first?
- What would prevent them from switching?

Real pilot behavior should influence the order of later modules.
