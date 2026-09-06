# YardClock Crew — Mobile Gate 4

`apps/crew` is a separate Expo/React Native workspace for the employee-facing YardClock experience. The existing Next.js application remains the manager application at the repository root. Gates 0–4 provide secure authentication, Today/My Schedule, Clock In/Out with one-time foreground location, a read-only employee Hours timesheet, and employee Time Off self-service. There is no manager approval UI, time editing, break controls, continuous/background location, route tracking, push, billing, or schedule editing.

## Prerequisites and install

- Node.js 22.13 or newer for Expo SDK 57
- pnpm
- Expo Go on a physical device, or an Android/iOS simulator supported by Expo
- Supabase CLI when running or migrating the local backend

From the repository root:

```powershell
pnpm install
pnpm --dir apps/crew install
Copy-Item apps/crew/.env.example apps/crew/.env
```

Fill in `apps/crew/.env` with the same **public** Supabase project values used by the web app:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Expo embeds `EXPO_PUBLIC_*` values in the client bundle. The Supabase anon/publishable key is intended for public clients and is safe only because authentication, grants, RLS, and database functions enforce access. Never put `SUPABASE_SERVICE_ROLE_KEY`, Stripe secrets, Resend secrets, or other server credentials in this file.

For local Supabase, a phone cannot reach the computer through `127.0.0.1`. Use a reachable development URL appropriate for the emulator/device, or use the hosted Supabase project. Do not change production redirect settings for Gate 0.

## Run

Start the Expo development server:

```powershell
pnpm --dir apps/crew start
```

Then scan the QR code with Expo Go, or launch a platform directly:

```powershell
pnpm --dir apps/crew android
pnpm --dir apps/crew ios
```

The iOS Simulator requires macOS. On Windows, use Expo Go on an iPhone or run the Android target.

Quality checks:

```powershell
pnpm --dir apps/crew typecheck
pnpm --dir apps/crew lint
pnpm --dir apps/crew test
pnpm --dir apps/crew check
pnpm --dir apps/crew bundle:android
```

## Authentication flow

Employees use the existing Supabase email/password identity created through YardClock's manager invitation flow. On startup, the app restores the session from AsyncStorage, validates it with `auth.getUser()`, refreshes tokens only while the native app is active, and listens for auth-state changes. Sign-out clears the persisted Supabase session.

After authentication, the app loads only RLS-authorized data and resolves context in this order:

1. `current_profile_id()` identifies the profile owned by the authenticated Supabase user.
2. `organization_memberships` is queried for that exact profile and an active membership.
3. If there is no membership, `accept_employee_invitation()` attempts the existing authenticated, email-matched invitation acceptance flow, then membership is reloaded.
4. `current_employee_id(organization_id)` resolves an active employee linked to the profile.
5. RLS-protected `organizations`, `roles`, and `employees` reads provide the Today screen context.
6. `has_permission(organization_id, capability)` checks the crew-relevant capabilities. These values guide the UI only; RLS and protected RPCs remain authoritative.

Today greets the linked employee and shows the organization, published work, current worked-time summary, and current account role.

## Existing backend reused

- Supabase Auth and the `handle_new_auth_user` profile trigger
- `profiles`, `organizations`, `organization_memberships`, `roles`, and `employees`
- `current_profile_id()`, `accept_employee_invitation()`, `current_employee_id()`, and `has_permission()`
- `time_off_requests`, `create_my_time_off_request()`, and `cancel_my_time_off_request()`
- Existing tenant isolation, table grants, RLS policies, and capability-based roles
- The checked-in web `Database` TypeScript contract, imported as a type-only dependency and extended locally for the invitation RPC and existing composite shift foreign-key metadata missing from that file

The repository also already contains protected scheduling, employee self-service, time-clock, field-job, and field-clock tables/RPCs. Future mobile gates should call those authoritative RPCs instead of duplicating their rules. Next.js Server Actions cannot be imported into React Native because they depend on the Next.js server runtime; their underlying PostgreSQL RPC boundaries are the reusable contract.

## Gate 2 Clock In/Out architecture

- Install with pnpm --dir apps/crew install. Gate 2 intentionally adds Expo SDK 57-compatible expo-location (~57.0.16) for foreground location and expo-crypto (~57.0.2) for random idempotency request IDs.
- Apply `supabase/migrations/202609030001_mobile_gate2_clock.sql` before using Clock against a backend. For local development, start Supabase and run `supabase migration up --local` from the repository root. Migration deployment remains an explicit environment operation rather than a mobile build step.
- Existing clock_in, clock_out, field_clock_attempt, perform_employee_clock_in, integrity validation, unique-open-entry index, permissions, RLS, and audit triggers remain unchanged. Additive mobile_clock_in/mobile_clock_out adapters call those operations instead of recreating their rules. mobile_clock_context returns only the authenticated employee's state and eligible details.
- Optional GPS evidence is stored on the existing time_entries row for both punches: latitude, longitude, accuracy radius, and device sample time. Worked time continues to use the existing server timestamp, never device time. Failed field checks use the existing field_clock_verifications row.
- GPS remains optional for ordinary clocking because the backend previously allowed it. If existing field-clock settings require a coordinate-configured assigned job, the app requires location and calls the unchanged field_clock_attempt. Gate 2 adds no geofence or new radius rule.
- Each punch receives a random request ID persisted before submission; coordinates are not persisted on-device. Retries return the first database result. Clock-in compares the latest-entry snapshot, and clock-out names the exact expected entry, so a delayed request cannot close newer work. The database still prevents duplicate open entries independently.
- On session restoration, tab focus, foreground resume, and pull-to-refresh, the shared Clock provider loads authoritative database state. If a response was lost, it checks the saved request ID before offering an explicit same-ID retry; it never starts a new punch automatically.
- Today only adds the shared clock status and an Open Clock action. The Gate 1 schedule design is otherwise unchanged.

### Location permission behavior

YardClock checks foreground permission, requests it when permitted, verifies location services, then requests one high-accuracy reading after an employee taps Clock In or Clock Out. It times out the UI after 15 seconds and sanitizes native errors. Permanent/restricted denial offers device Settings. Ordinary clocking may explicitly continue without GPS after failure; required existing field verification may not.

The app configuration disables iOS/Android background location and Android foreground location services. It never uses watchers, background tasks, geofencing, or repeated polling. API reference: https://docs.expo.dev/versions/v57.0.0/sdk/location/

### Physical-device smoke test

Use HTTPS hosted Supabase values or a LAN-reachable local URL in apps/crew/.env; 127.0.0.1 on a phone means the phone. Run pnpm --dir apps/crew start, scan the Expo Go QR code, sign in as a disposable employee, and:

1. Open Clock and confirm it restores the database state.
2. Tap Clock In, grant foreground location, then verify status/elapsed time and the clock-in GPS fields.
3. Background/foreground the app and verify status restoration.
4. Tap Clock Out, then verify the entry is completed and clock-out GPS is populated.
5. Deny permission and confirm ordinary work offers an explicit no-location option while required field work does not.

## Gate 3 Hours architecture

- `src/services/crew-hours.ts` is the single mobile time-record read path. Every load verifies the Supabase user, re-resolves `current_employee_id(organization_id)`, rechecks `timeclock.view_self`, and filters `time_entries` by the exact organization, employee, and organization-local week. PostgreSQL RLS independently limits entries to the current employee for self-service accounts. Related `time_breaks` remain protected through `can_view_time_entry(...)`.
- Hours directly reuses the existing pure web calculation in `src/modules/time-clock/services/calculations.ts`: gross time is the server clock-out timestamp minus server clock-in timestamp, all completed `time_breaks` intervals are deducted, and the final result is rounded to minutes. The schema has no paid/unpaid break flag, so every recorded break is treated the same way as the web timesheet. Gate 3 does not change this rule.
- For an open entry only, mobile supplies the current device instant as a temporary display end and supplies that same instant for an active break. This produces a locally refreshed provisional net duration without database writes. Server punch timestamps and the eventual closed entry remain authoritative. The app reloads after clock-state changes, screen focus, foreground resume, and pull-to-refresh.
- Weeks run Monday through Sunday using the organization timezone and DST-aware zoned midnights. Matching the existing web My Timesheet screen, an entry belongs to the week and day containing its organization-local clock-in timestamp; an overnight entry is not split across calendar days.
- The Hours summary shows current-week net time, today’s net time, and the active clock-in when present. Entries are grouped by day, multiple entries remain separate, and each day has a total. Expandable details show gross/break/net time, safe location and linked-schedule context, approval/adjustment state, and only whether punch location evidence was recorded—never raw coordinates.
- Existing states are presented without inventing payroll semantics: `review_status = approved` is “Approved,” other completed entries are “Pending Review,” corrected entries also show “Adjusted,” open entries are “In Progress,” and cancelled entries are “Cancelled.” There is no locked, exported, or payroll-ready state in the current time-entry schema.
- Gate 3 is read-only. It adds no time-entry editing, corrections, approvals, exports, pay rates, labor costs, break controls, service-role client, RPC, view, migration, or RLS change.

### Gate 3 authenticated local integration

Set `CREW_LOCAL_TEST_URL`, `CREW_LOCAL_TEST_ANON_KEY`, `CREW_LOCAL_TEST_EMAIL`, and `CREW_LOCAL_TEST_PASSWORD` in the shell, then run:

```powershell
pnpm --dir apps/crew test tests/hours.local.test.ts
```

The test refuses hosted URLs and uses only the authenticated anon client. It loads the current employee’s current week, verifies that returned breaks belong to visible entries, exercises the shared calculation for open/closed records when present, and confirms cross-employee and cross-organization RLS behavior. It performs no writes.

### Gate 3 iPhone smoke-test checklist

The Gate 3 physical-device smoke test passed on an iPhone using this checklist:

1. Sign in.
2. Open Hours and confirm the current Monday–Sunday week.
3. Clock In.
4. Return to Hours and confirm the open entry appears.
5. Wait at least one minute and confirm the provisional elapsed time updates.
6. Clock Out.
7. Return to Hours and confirm the closed net total updates.
8. Close and reopen the app and confirm totals persist from Supabase.
9. Navigate to the previous week and back to the current week.

Gate 3 physical-device verification passed on an iPhone (user-confirmed after the automated implementation workflow).

### Gate 3 verification

- Mobile TypeScript and ESLint: passed with no warnings.
- 81 deterministic mobile tests passed; 7 opt-in integration tests were skipped in the normal run.
- 3 read-only Hours integration tests and 4 existing schedule/clock integration tests passed separately against an authenticated local employee. The clock workflow verified Hours while open, active/completed break reads, clock-out, refreshed closed totals, and employee/tenant isolation.
- Expo dependency compatibility: passed. Android production export: passed (1,343 modules). Offline Metro startup and Android Expo manifest HTTP 200: passed; Metro was then stopped.
- Existing web TypeScript, zero-warning ESLint, all 94 tests, and the 37-route production build: passed.
- Local database/RLS suite: 10 files and 432 assertions passed, including time tracking and mobile clock security. Supabase schema/function lint: no errors.
- Gate 3 physical-device smoke test: passed on an iPhone (user-confirmed).

## Gate 4 Time Off architecture

- `src/services/crew-time-off.ts` is the only mobile read/mutation path. Each operation validates the Supabase user, re-resolves `current_employee_id(organization_id)`, and rechecks either `timeoff.view_self` or `timeoff.request`. Reads also apply exact organization and employee filters and select only employee-safe fields. Existing grants and RLS independently enforce self-service isolation.
- New requests use the existing `create_my_time_off_request(organization_id, start_date, end_date, reason)` RPC. The RPC derives the employee from the authenticated profile and always creates a `pending` request; mobile cannot choose an employee, status, review metadata, or manager note.
- Cancellation uses the existing `cancel_my_time_off_request(request_id)` RPC. Mobile offers the action only for `pending` requests and requires native confirmation. The RPC rechecks ownership/capability and rejects stale, approved, denied, cancelled, foreign-employee, and cross-tenant targets.
- The backend supports full-day `date` ranges only. Gate 4 does not invent partial-day time fields. Inputs and “today” grouping use the organization timezone, while stored date values remain unchanged calendar dates. The form checks required/real dates, date order, and the existing 2,000-character reason limit before the RPC; PostgreSQL remains authoritative.
- The list presents the backend’s existing statuses only: Pending, Approved, Denied, and Cancelled. It shows the employee reason and, for decided requests, the manager note already exposed by the existing web employee page. It deliberately omits `reviewed_by` and provides no approve/deny call or manager control.
- Approved requests continue to feed the unchanged web scheduling warning query. Mobile only displays, submits, and cancels requests; it adds no scheduling rule or schedule mutation.
- Pull-to-refresh, tab focus, foreground resume, successful submission, and successful cancellation reload authoritative data. Concurrent taps are locked locally, controls show submission/cancellation progress, and backend errors are translated without exposing Supabase/PostgreSQL details.

### Gate 4 authenticated local integration

Set `CREW_LOCAL_TEST_URL`, `CREW_LOCAL_TEST_ANON_KEY`, `CREW_LOCAL_TEST_EMAIL`, `CREW_LOCAL_TEST_PASSWORD`, and `CREW_LOCAL_TIME_OFF_WRITES=1` in the shell, then run:

```powershell
pnpm --dir apps/crew test tests/time-off.local.test.ts
```

The test refuses hosted URLs and uses only the authenticated anon client for the assertions. It loads the employee’s requests, creates one uniquely named future request, confirms it reloads as Pending, cancels it, and confirms the Cancelled status. It also verifies cross-employee/cross-tenant reads are empty, direct insert/review-field updates are rejected, an unknown/other cancellation is rejected, and the Employee role cannot approve or deny. Cleanup retries cancellation if the workflow stops after creation.

### Gate 4 iPhone smoke-test checklist

The Gate 4 physical-device smoke test passed on an iPhone using this checklist:

1. Sign in.
2. Open Time Off.
3. Confirm existing requests load.
4. Create a new full-day request and review the confirmation summary.
5. Confirm it appears as Pending.
6. Close and reopen the app.
7. Confirm the request persists.
8. Cancel the pending request after confirming the native prompt.
9. Confirm its status updates to Cancelled.
10. Verify other existing Approved and Denied requests display correctly if test data exists.

### Gate 4 verification

- Mobile TypeScript and zero-warning ESLint: passed.
- 101 deterministic mobile tests passed; 11 opt-in integration tests were skipped in the normal run.
- 4 Time Off authenticated-local integration tests and 7 existing Schedule/Clock/Hours integration tests passed against a disposable Employee-role account. The Time Off lifecycle creates and then cancels only a local request.
- Expo dependency compatibility: passed. Android production export: passed (1,347 modules). Offline Metro returned an Android Expo manifest with HTTP 200 and was then stopped.
- Existing web TypeScript, zero-warning ESLint, all 94 tests, and the 37-route production build: passed.
- Local database/RLS suite: 10 files and 432 assertions passed, including employee self-service time-off security. Supabase schema/function lint: no errors.
- Gate 4 physical-device smoke test: passed on an iPhone (user-confirmed).

## Gate 1 schedule architecture

- `src/services/crew-schedule.ts` is the single mobile read path. It validates the authenticated user, rechecks `current_employee_id()` and `has_permission('schedule.view')`, and requests only necessary shift/detail columns.
- PostgREST filters by organization, current employee, `shifts.status = published`, and an **inner joined** `schedules.status = published`. Date predicates select shifts overlapping the requested interval: start before its end, end after its start. PostgreSQL RLS remains authoritative; there is no service-role client and no mobile schedule write path.
- Existing scheduling RLS already protects employees' assigned published work. Additional coverage policies authorize unassigned open shifts, and manager/labor capabilities authorize broader reads. The mobile query deliberately excludes these from the crew experience without changing existing backend permissions.
- `shifts.employee_id` is the assignment. Composite foreign keys resolve the shift's own `locations`, `departments`, and optional `roles` within its tenant. Optional details are left joins so hidden/missing details do not hide the shift itself.
- **There is no shift-to-job relationship.** Field `jobs`/`job_assignments` are separate, even when a job shares a location. Gate 1 does not guess job matches or load job notes. It displays the shift location's name, address/city/state/postal code, department/role, and employee-readable `shifts.notes`.
- The shared web `src/core/shared/day-window.ts` and `src/modules/scheduling/lib/dates.ts` utilities are imported directly (pure TypeScript; no Next.js runtime). Today uses the organization timezone and includes overnight carry-in. Cards stay chronological; the first shift whose end is still ahead is highlighted as “Scheduled now” or “Up next.” These are schedule labels, not clock status.
- `metro.config.js` watches those shared pure-code directories plus the existing time-clock calculation directory explicitly because mobile and web dependency workspaces are intentionally isolated.
- My Schedule defaults to Monday–Sunday in that timezone, supports previous/next/back-to-current week, and groups work by each day it overlaps. Overnight shifts may appear under both dates, with actual start/end date labels. DST boundaries use zoned midnights.
- `src/hooks/use-crew-schedule.ts` handles loading, pull-to-refresh, foreground/tab-focus reloads, a 20-second timeout, and stale-request cancellation. Dates/highlights update every minute while focused. Failed or refreshed reads clear old business data; there is no offline schedule cache.
- Directions appears only for a syntactically usable street address. Fixed Apple Maps/Android geo URLs use encoded address text and React Native Linking, with an HTTPS fallback and a friendly failure alert. This is not geocoding or address verification and collects no device location.

Implementation references: [Supabase nested reads and inner filters](https://supabase.com/docs/reference/javascript/select), [React Native Linking](https://reactnative.dev/docs/linking).

## Gate 1 verification

Mobile tests use the repository's existing Vitest installation; install root dependencies as well as mobile dependencies. No new package dependency was added.

- `pnpm --dir apps/crew test`: deterministic query/presentation tests. Local integration tests are skipped unless explicitly configured.
- `pnpm test` and `pnpm typecheck` at the root: existing web regression checks.
- `pnpm test:db`: local transactional RLS suite, including eight additional scheduling assertions. All fixture changes roll back.
- `pnpm --dir apps/crew bundle:android`: writes an ignored Android export to `apps/crew/dist`.

For read-only real-client integration, set `CREW_LOCAL_TEST_URL`, `CREW_LOCAL_TEST_ANON_KEY`, `CREW_LOCAL_TEST_EMAIL`, and `CREW_LOCAL_TEST_PASSWORD` in your shell, then run:

```powershell
pnpm --dir apps/crew test tests/schedule.local.test.ts
```

The test refuses non-local URLs. It expects an existing Employee-role test account with an active employee link, a published shift and readable location, and an organization other than the known Acme seed tenant. Existing web Gate 1 end-to-end fixtures meet these requirements. Never put test passwords in Expo public variables. The integration test performs no business-data mutations.

Verified during implementation:

- Mobile TypeScript and ESLint: passed.
- 41 deterministic mobile tests and 3 separately enabled real-local-employee integration tests: passed.
- Android export: passed (1,316 modules). Metro startup/status and Android manifest HTTP 200: passed; the server was then stopped.
- Existing web TypeScript, ESLint, and all 94 tests: passed.
- Local DB/RLS suite: 389 assertions passed, including 8 new mobile scheduling checks.
- Tracked/untracked whitespace checks and private-credential scan of mobile source/Android export: passed.

Gate 1's original automated verification did not include a phone/emulator. Physical iPhone coverage was subsequently completed at the Gate 2 checkpoint described below. Metro used a fallback React Native DevTools version after a local cache-install warning. The offline smoke test also emitted a manifest-asset resolution warning; startup, the manifest response, and the Android export (including assets) succeeded.

## Gate 2 verification

- Mobile TypeScript and ESLint: passed.
- Expo dependency compatibility: passed.
- 63 deterministic mobile tests: passed. Four opt-in integration tests (three schedule plus one punch workflow): passed against authenticated local employee clients.
- The punch integration verified Clock In with GPS, authoritative reload, duplicate/retry behavior, cross-employee/cross-tenant rejection, Clock Out with GPS, and closure. It writes completed entries only to the disposable local Gate 1 test organization.
- Android production export: passed (1,337 modules). Metro status and Android manifest HTTP 200: passed.
- Existing web TypeScript, ESLint, and all 94 tests: passed.
- Local database/RLS suite: 10 files and 432 assertions passed. Supabase schema/function lint: no errors.
- Private-credential scan of mobile source/export, forbidden-background-location scan, and diff whitespace checks: passed.
- A physical iPhone smoke test of the completed Gate 0–2 app passed against hosted Supabase using the existing YardClock login after that profile was linked to one active employee record.

To opt into the authenticated write integration manually, set CREW_LOCAL_TEST_URL, CREW_LOCAL_TEST_ANON_KEY, CREW_LOCAL_TEST_EMAIL, CREW_LOCAL_TEST_PASSWORD, and CREW_LOCAL_CLOCK_WRITES=1, then run:

    pnpm --dir apps/crew test tests/clock.local.test.ts

The test refuses non-local URLs, requires an existing disposable Employee-role @gate1-test.example account without an open entry or field requirement, and leaves a completed local test time entry for auditability.

The physical iPhone smoke test passed. Maps-app behavior can still vary by installed apps and platform and should remain part of future release smoke testing. No Android emulator/ADB was installed here. Offline Metro used a fallback DevTools version after a non-blocking local cache warning.

## Current limitations

- Time Off supports employee full-day requests and pending cancellation only. It does not support partial-day requests or manager decisions. Hours remains read-only and cannot edit or submit corrections.
- No account creation, invitation sending, password reset, or password-setting UI exists in mobile.
- The existing manager invitation must be completed and a password established through the existing YardClock/Supabase flow before email/password mobile sign-in can succeed.
- The shell selects the oldest active organization membership. Organization switching is not part of Gate 0.
- No offline business-data cache is implemented. Only the authentication session persists.
- Foreground GPS is captured only at explicit punches. No background GPS, push notifications, or native production builds are configured.
- No database migration or RLS change was required for Mobile Gates 3–4; they reuse the existing web time-tracking and employee time-off backends plus the additive Gate 2 mobile punch evidence.
- Field-job assignments are not included in Today/My Schedule because they are not linked to shifts; the screens represent published schedule work only.
- As with the web app, existing manager/labor privileges are not reduced by signing into mobile. The app's query is narrower, but it does not create a new restricted backend role.
- Gate 0's nested workspace has different web/mobile React versions. Keep installs isolated and verify native builds when upgrading Expo; no web React dependency was changed here.
- Hours displays existing breaks and deducts them exactly like the web timesheet, but mobile still has no break start/stop controls. If an open break prevents clock-out, mobile directs the employee to the existing web workflow.
- Field-clock manager overrides remain in the existing web workflow. Mobile displays a failed verification result but does not approve or consume overrides.
- Punch evidence is visible under the existing `time_entries`/`field_clock_verifications` RLS grants; Gate 2 introduces no separate permission model.
