# Workforce Platform — Codex Rules

These rules apply to all Codex work in this repository unless explicitly changed by the project owner.

## 1. Work One Milestone at a Time

Do not build future modules early.

If the assignment is Gate 0, do not add scheduling.
If the assignment is Scheduling, do not add Time Clock.
If the assignment is Time Clock, do not add AI.

Finish the requested scope, run tests, report results, and stop.

## 2. Do Not Modify Unrelated Modules

Make the smallest reasonable change set for the assigned task.

Do not refactor unrelated code "while here" unless required for correctness and clearly reported.

## 3. Tenant Isolation Is Mandatory

Every organization-owned table must use `organization_id` unless architecture documentation explicitly says otherwise.

Never weaken or remove tenant isolation to make a feature pass.

## 4. Never Disable RLS to Fix a Problem

Every new organization-owned table requires appropriate Row Level Security policies.

A feature is not complete if it only works by using unrestricted database access in normal application flows.

## 5. Cross-Tenant Access Must Be Tested

For business-owned data, tests must verify that one organization cannot read or mutate another organization's rows, including when IDs are known.

## 6. Respect Module Boundaries

Feature modules own their domain data and behavior.

Do not directly mutate another module's tables when a defined service/action exists.

Example: Open Shifts and Shift Swaps must use the Scheduling mutation layer to change shift assignments.

## 7. AI Must Not Bypass Domain Services

Future AI features may propose changes but must not write directly to protected production tables or bypass validation, permissions, RLS, or manager approval.

## 8. Preserve Scheduled vs. Actual Data

Do not overwrite schedule records with time-clock punches.

Scheduled time and actual time are separate concepts and must remain independently reportable.

## 9. Permissions Must Be Capability-Based

Prefer explicit capabilities such as `schedule.publish` or `timeoff.approve` rather than scattering hard-coded role-name checks throughout the application.

## 10. Protect Sensitive Wage Data

Employee wage data must not be exposed through broad employee or schedule queries.

Use dedicated permissions for wage and labor visibility.

## 11. Database Migrations Must Be Reviewable

Every schema change must be represented by a migration.

Do not make undocumented manual production schema changes.

Where practical, migrations should be reversible or include a clear rollback path.

## 12. Keep Secrets Out of Git

Never commit:

- `.env.local`
- Supabase service-role keys
- API secrets
- private tokens
- production credentials

Use environment variables and documented example files with placeholder values only.

## 13. Validate at Trust Boundaries

Validate server inputs.

Do not rely only on client-side validation for authorization, tenant scope, dates, IDs, or business rules.

## 14. Server-Side Authorization Is Required

Hiding a button is not security.

Sensitive actions must verify identity, organization membership, and capability on the server/database path.

## 15. Existing Tests Must Keep Passing

Do not accept a new feature that breaks previously passing tests unless the architecture or expected behavior was intentionally changed and documented.

## 16. Add Tests With New Behavior

New domain behavior should include appropriate unit, integration, or end-to-end coverage.

High-value workflows should eventually be covered by Playwright.

## 17. Keep Dependencies Intentional

Do not add npm packages without a clear need.

Prefer platform/framework capabilities when they adequately solve the problem.

Report any new dependency and why it was added.

## 18. Avoid Premature Complexity

Do not implement payroll, benefits, recruiting, tax filing, advanced HR, GPS, AI scheduling, or complex reporting before their roadmap gate.

The MVP should remain understandable and maintainable.

## 19. Mobile Employee Experience Matters

Employee-facing pages must be responsive and usable on a phone.

Manager workflows may take advantage of larger desktop layouts, especially weekly scheduling.

## 20. Report What Changed

At the end of every assignment, report:

- Files changed
- Migrations added
- Tests added or changed
- Commands/tests run
- Pass/fail results
- Known limitations
- Environment/configuration steps required
- Recommended next milestone

Do not claim a test passed unless it was actually run successfully.

## 21. Stop at the Gate

When the requested milestone is complete and its tests pass, stop.

Do not begin the next module without a new instruction.
