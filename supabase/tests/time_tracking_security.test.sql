begin;
select plan(58);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '4a000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'gate4-owner-a@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '4a000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'gate4-manager-a@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '4a000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'gate4-employee-a@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '4a000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'gate4-employee-b@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '4b000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'gate4-owner-b@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

set local role authenticated;
set local "request.jwt.claim.sub" = '4a000000-0000-0000-0000-000000000001';
select public.create_organization('Gate 4 Company A', 'gate4-company-a', 'America/New_York');

reset role;
insert into public.organization_memberships (organization_id, profile_id, role_id, membership_role, status)
select organization.id, profile.id, role.id, setup.membership_role, 'active'
from (values
  ('4a000000-0000-0000-0000-000000000002'::uuid, 'Manager'::text, 'manager'::public.membership_role),
  ('4a000000-0000-0000-0000-000000000003'::uuid, 'Employee'::text, 'employee'::public.membership_role),
  ('4a000000-0000-0000-0000-000000000004'::uuid, 'Employee'::text, 'employee'::public.membership_role)
) setup(auth_user_id, role_name, membership_role)
join public.profiles profile on profile.auth_user_id = setup.auth_user_id
cross join public.organizations organization
join public.roles role on role.organization_id = organization.id and role.name = setup.role_name
where organization.slug = 'gate4-company-a';

insert into public.employees (id, organization_id, profile_id, first_name, last_name, email)
select setup.employee_id, organization.id, profile.id, setup.first_name, setup.last_name, setup.email
from (values
  ('4a100000-0000-0000-0000-000000000001'::uuid, '4a000000-0000-0000-0000-000000000003'::uuid, 'Employee', 'A', 'employee-a@gate4.example'),
  ('4a100000-0000-0000-0000-000000000002'::uuid, '4a000000-0000-0000-0000-000000000004'::uuid, 'Employee', 'B', 'employee-b@gate4.example')
) setup(employee_id, auth_user_id, first_name, last_name, email)
join public.profiles profile on profile.auth_user_id = setup.auth_user_id
cross join public.organizations organization
where organization.slug = 'gate4-company-a';

insert into public.locations (id, organization_id, name, address, city, state, postal_code)
select '4a200000-0000-0000-0000-000000000001', id, 'Gate 4 Office', '4 Time Way', 'Sampleville', 'NY', '10001'
from public.organizations where slug = 'gate4-company-a';
insert into public.departments (id, organization_id, location_id, name)
select '4a300000-0000-0000-0000-000000000001', id, '4a200000-0000-0000-0000-000000000001', 'Operations'
from public.organizations where slug = 'gate4-company-a';
insert into public.schedules (id, organization_id, location_id, week_start, status, published_at, published_by, created_by)
select '4a400000-0000-0000-0000-000000000001', organization.id,
  '4a200000-0000-0000-0000-000000000001', '2026-08-17', 'published', now(), profile.id, profile.id
from public.organizations organization
join public.profiles profile on profile.auth_user_id = '4a000000-0000-0000-0000-000000000001'
where organization.slug = 'gate4-company-a';
insert into public.shifts (
  id, organization_id, schedule_id, location_id, department_id, employee_id,
  start_at, end_at, status, notes, created_by
)
select '4a500000-0000-0000-0000-000000000001', organization.id,
  '4a400000-0000-0000-0000-000000000001', '4a200000-0000-0000-0000-000000000001',
  '4a300000-0000-0000-0000-000000000001', '4a100000-0000-0000-0000-000000000001',
  '2026-08-17 13:00+00', '2026-08-17 21:00+00', 'published', 'Scheduled reference', profile.id
from public.organizations organization
join public.profiles profile on profile.auth_user_id = '4a000000-0000-0000-0000-000000000001'
where organization.slug = 'gate4-company-a';

set local role authenticated;
set local "request.jwt.claim.sub" = '4b000000-0000-0000-0000-000000000001';
select public.create_organization('Gate 4 Company B', 'gate4-company-b', 'America/Chicago');
reset role;
insert into public.employees (id, organization_id, profile_id, first_name, last_name, email)
select '4b100000-0000-0000-0000-000000000001', organization.id, profile.id,
  'Company', 'B Owner', 'owner-b-employee@gate4.example'
from public.organizations organization
join public.profiles profile on profile.auth_user_id = '4b000000-0000-0000-0000-000000000001'
where organization.slug = 'gate4-company-b';
insert into public.locations (id, organization_id, name, address, city, state, postal_code)
select '4b200000-0000-0000-0000-000000000001', id, 'Company B Office', '9 Other Way', 'Elsewhere', 'IL', '60001'
from public.organizations where slug = 'gate4-company-b';

insert into public.time_entries (
  id, organization_id, employee_id, shift_id, location_id, clock_in_at, clock_out_at,
  status, source, created_by
)
select setup.entry_id, organization.id, setup.employee_id, setup.shift_id,
  setup.location_id, setup.clock_in_at, setup.clock_out_at, 'completed', 'system', profile.id
from (values
  ('4a600000-0000-0000-0000-000000000001'::uuid, '4a100000-0000-0000-0000-000000000001'::uuid, '4a500000-0000-0000-0000-000000000001'::uuid, '4a200000-0000-0000-0000-000000000001'::uuid, '2026-08-17 13:00+00'::timestamptz, '2026-08-17 21:00+00'::timestamptz),
  ('4a600000-0000-0000-0000-000000000002'::uuid, '4a100000-0000-0000-0000-000000000002'::uuid, null::uuid, '4a200000-0000-0000-0000-000000000001'::uuid, '2026-08-18 13:00+00'::timestamptz, '2026-08-18 21:00+00'::timestamptz)
) setup(entry_id, employee_id, shift_id, location_id, clock_in_at, clock_out_at)
cross join public.organizations organization
join public.profiles profile on profile.auth_user_id = '4a000000-0000-0000-0000-000000000001'
where organization.slug = 'gate4-company-a';
insert into public.time_breaks (id, organization_id, time_entry_id, start_at, end_at)
select '4a700000-0000-0000-0000-000000000001', organization_id, id,
  '2026-08-17 17:00+00', '2026-08-17 17:30+00'
from public.time_entries where id = '4a600000-0000-0000-0000-000000000001';

insert into public.time_entries (
  id, organization_id, employee_id, location_id, clock_in_at, clock_out_at,
  status, source, created_by
)
select '4b600000-0000-0000-0000-000000000001', organization.id,
  '4b100000-0000-0000-0000-000000000001', '4b200000-0000-0000-0000-000000000001',
  '2026-08-17 14:00+00', '2026-08-17 22:00+00', 'completed', 'system', profile.id
from public.organizations organization
join public.profiles profile on profile.auth_user_id = '4b000000-0000-0000-0000-000000000001'
where organization.slug = 'gate4-company-b';
insert into public.time_breaks (id, organization_id, time_entry_id, start_at, end_at)
select '4b700000-0000-0000-0000-000000000001', organization_id, id,
  '2026-08-17 18:00+00', '2026-08-17 18:30+00'
from public.time_entries where id = '4b600000-0000-0000-0000-000000000001';

set local role authenticated;
set local "request.jwt.claim.sub" = '4a000000-0000-0000-0000-000000000003';
select ok(public.has_permission((select id from public.organizations where slug = 'gate4-company-a'), 'timeclock.use'), 'Employee receives timeclock.use');
select ok(public.has_permission((select id from public.organizations where slug = 'gate4-company-a'), 'timeclock.view_self'), 'Employee receives timeclock.view_self');
select ok(not public.has_permission((select id from public.organizations where slug = 'gate4-company-a'), 'timeclock.view'), 'Employee does not receive timeclock.view');
select ok(not public.has_permission((select id from public.organizations where slug = 'gate4-company-a'), 'timeclock.edit'), 'Employee does not receive timeclock.edit');
set local "request.jwt.claim.sub" = '4a000000-0000-0000-0000-000000000002';
select ok(public.has_permission((select id from public.organizations where slug = 'gate4-company-a'), 'timeclock.view'), 'Manager receives timeclock.view');
select ok(public.has_permission((select id from public.organizations where slug = 'gate4-company-a'), 'timeclock.edit'), 'Manager receives timeclock.edit');
set local "request.jwt.claim.sub" = '4a000000-0000-0000-0000-000000000001';
select ok(public.has_permission((select id from public.organizations where slug = 'gate4-company-a'), 'timeclock.view'), 'Owner receives timeclock.view');
select ok(public.has_permission((select id from public.organizations where slug = 'gate4-company-a'), 'timeclock.edit'), 'Owner receives timeclock.edit');

set local "request.jwt.claim.sub" = '4a000000-0000-0000-0000-000000000003';
select is((select count(*)::integer from public.time_entries), 1, 'Employee sees only own time entries');
select is((select count(*)::integer from public.time_breaks), 1, 'Employee sees only breaks on own time entries');
select is((select count(*)::integer from public.time_entries where id = '4a600000-0000-0000-0000-000000000002'), 0, 'Employee cannot see another employee time entry');
select is((select count(*)::integer from public.time_entries where id = '4b600000-0000-0000-0000-000000000001'), 0, 'Company A employee cannot see Company B time');
select is((select count(*)::integer from public.time_breaks where id = '4b700000-0000-0000-0000-000000000001'), 0, 'Company A employee cannot see Company B breaks');
select throws_ok($$ insert into public.time_entries (
  organization_id, employee_id, location_id, clock_in_at, status, source, created_by
) values (
  (select id from public.organizations where slug = 'gate4-company-a'),
  '4a100000-0000-0000-0000-000000000001', '4a200000-0000-0000-0000-000000000001',
  now(), 'open', 'employee', public.current_profile_id()
) $$, '42501', null, 'Employees cannot write time entries directly');
select throws_ok($$ update public.time_entries set correction_note = 'Bypass' where id = '4a600000-0000-0000-0000-000000000001' $$, '42501', null, 'Employees cannot update time entries directly');
select throws_ok($$ delete from public.time_entries where id = '4a600000-0000-0000-0000-000000000001' $$, '42501', null, 'Employees cannot delete time entries directly');
select throws_ok($$ select public.correct_time_entry(
  '4a600000-0000-0000-0000-000000000001', '4a200000-0000-0000-0000-000000000001',
  '2026-08-17 09:00', '2026-08-17 17:00', 'Unauthorized'
) $$, '42501', 'Time-entry correction permission required', 'Employee cannot correct an own time entry');
select throws_ok($$ select public.approve_time_entry('4a600000-0000-0000-0000-000000000001') $$,
  '42501', 'Time-entry approval permission required', 'Employee cannot approve an own time entry');

select lives_ok($$ select public.clock_in(
  (select id from public.organizations where slug = 'gate4-company-a'),
  '4a200000-0000-0000-0000-000000000001', '4a500000-0000-0000-0000-000000000001'
) $$, 'Employee can clock in through the trusted function');
select is((select shift_id from public.time_entries where status = 'open'),
  '4a500000-0000-0000-0000-000000000001'::uuid, 'Clock-in can link the assigned published shift');
select throws_ok($$ select public.clock_in(
  (select id from public.organizations where slug = 'gate4-company-a'),
  '4a200000-0000-0000-0000-000000000001', null
) $$, 'P0001', 'Employee already has an open time entry', 'Duplicate clock-in is rejected safely');
select lives_ok($$ select public.start_break((select id from public.organizations where slug = 'gate4-company-a')) $$,
  'Employee can start a break while clocked in');
select throws_ok($$ select public.start_break((select id from public.organizations where slug = 'gate4-company-a')) $$,
  'P0001', 'A break is already active', 'Duplicate break start is rejected safely');
select throws_ok($$ select public.clock_out((select id from public.organizations where slug = 'gate4-company-a')) $$,
  'P0001', 'End the active break before clocking out', 'Clock-out is blocked during an active break');
select lives_ok($$ select public.end_break((select id from public.organizations where slug = 'gate4-company-a')) $$,
  'Employee can end an active break');
select throws_ok($$ select public.end_break((select id from public.organizations where slug = 'gate4-company-a')) $$,
  'P0001', 'No active break exists to end', 'Duplicate break end is rejected safely');
select lives_ok($$ select public.clock_out((select id from public.organizations where slug = 'gate4-company-a')) $$,
  'Employee can clock out after ending the break');
select is((select status::text from public.time_entries order by created_at desc limit 1), 'completed', 'Clock-out completes the open time entry');
select throws_ok($$ select public.clock_out((select id from public.organizations where slug = 'gate4-company-a')) $$,
  'P0001', 'No open time entry exists to clock out', 'Duplicate clock-out is rejected safely');
select is((select start_at::text from public.shifts where id = '4a500000-0000-0000-0000-000000000001'),
  '2026-08-17 13:00:00+00', 'Actual time actions do not alter scheduled start');
select is((select end_at::text from public.shifts where id = '4a500000-0000-0000-0000-000000000001'),
  '2026-08-17 21:00:00+00', 'Actual time actions do not alter scheduled end');

set local "request.jwt.claim.sub" = '4a000000-0000-0000-0000-000000000004';
select throws_ok($$ select public.clock_in(
  (select id from public.organizations where slug = 'gate4-company-a'),
  '4a200000-0000-0000-0000-000000000001', '4a500000-0000-0000-0000-000000000001'
) $$, 'P0001', 'Linked shift must be an assigned published shift for the same employee, organization, and location',
  'Employee cannot clock against another employee assigned shift');

set local "request.jwt.claim.sub" = '4a000000-0000-0000-0000-000000000002';
select is((select count(*)::integer from public.time_entries), 3, 'Manager sees all Company A time entries');
select lives_ok($$ select public.correct_time_entry(
  '4a600000-0000-0000-0000-000000000001', '4a200000-0000-0000-0000-000000000001',
  '2026-08-17 08:45', '2026-08-17 17:15', 'Verified against paper log'
) $$, 'Manager can correct a completed time entry');
select is((select status::text from public.time_entries where id = '4a600000-0000-0000-0000-000000000001'), 'corrected', 'Correction changes entry status');
select is((select source::text from public.time_entries where id = '4a600000-0000-0000-0000-000000000001'), 'manager', 'Correction records manager source');
select is((select correction_note from public.time_entries where id = '4a600000-0000-0000-0000-000000000001'), 'Verified against paper log', 'Correction reason is persisted');
select ok((select original_clock_in_at is not null and original_clock_out_at is not null and original_location_id is not null
  from public.time_entries where id = '4a600000-0000-0000-0000-000000000001'), 'Correction preserves original values');
select is((select review_status::text from public.time_entries where id = '4a600000-0000-0000-0000-000000000001'), 'unreviewed', 'Correction resets review state');
select throws_ok($$ select public.correct_time_entry(
  '4a600000-0000-0000-0000-000000000001', '4a200000-0000-0000-0000-000000000001',
  '2026-08-17 18:00', '2026-08-17 08:00', 'Invalid range'
) $$, 'P0001', 'Corrected clock-out must be after clock-in', 'Reversed correction range is rejected');
select lives_ok($$ select public.approve_time_entry('4a600000-0000-0000-0000-000000000001') $$,
  'Manager can approve a corrected time entry');
select is((select review_status::text from public.time_entries where id = '4a600000-0000-0000-0000-000000000001'), 'approved', 'Approval state is persisted');
select ok((select approved_by is not null and approved_at is not null
  from public.time_entries where id = '4a600000-0000-0000-0000-000000000001'), 'Approval records manager and timestamp');
select throws_ok($$ select public.correct_time_entry(
  '4b600000-0000-0000-0000-000000000001', '4b200000-0000-0000-0000-000000000001',
  '2026-08-17 09:00', '2026-08-17 17:00', 'Cross tenant'
) $$, '42501', 'Time-entry correction permission required', 'Company A manager cannot correct Company B time');
select throws_ok($$ select public.approve_time_entry('4b600000-0000-0000-0000-000000000001') $$,
  '42501', 'Time-entry approval permission required', 'Company A manager cannot approve Company B time');
select throws_ok($$ insert into public.time_breaks (organization_id, time_entry_id, start_at)
  values ((select id from public.organizations where slug = 'gate4-company-a'),
  '4a600000-0000-0000-0000-000000000001', now()) $$,
  '42501', null, 'Managers cannot write breaks directly');
select throws_ok($$ select public.clock_in(
  (select id from public.organizations where slug = 'gate4-company-b'),
  '4b200000-0000-0000-0000-000000000001', null
) $$, '42501', 'Time-clock use permission required', 'Company A manager cannot clock into Company B');
select throws_ok($$ insert into public.time_entries (
  organization_id, employee_id, location_id, clock_in_at, status, source, created_by
) values (
  (select id from public.organizations where slug = 'gate4-company-b'),
  '4b100000-0000-0000-0000-000000000001', '4b200000-0000-0000-0000-000000000001',
  now(), 'open', 'manager', public.current_profile_id()
) $$, '42501', null, 'Company A cannot create time for a Company B employee');
select throws_ok($$ update public.time_entries set correction_note = 'Cross tenant'
  where id = '4b600000-0000-0000-0000-000000000001' $$,
  '42501', null, 'Company A cannot update Company B time directly');
select throws_ok($$ delete from public.time_entries where id = '4b600000-0000-0000-0000-000000000001' $$,
  '42501', null, 'Company A cannot delete or cancel Company B time directly');
select throws_ok($$ select public.clock_out((select id from public.organizations where slug = 'gate4-company-b')) $$,
  '42501', 'Time-clock use permission required', 'Company A cannot clock out a Company B employee');
select throws_ok($$ select public.start_break((select id from public.organizations where slug = 'gate4-company-b')) $$,
  '42501', 'Time-clock use permission required', 'Company A cannot start a Company B break');
select throws_ok($$ select public.end_break((select id from public.organizations where slug = 'gate4-company-b')) $$,
  '42501', 'Time-clock use permission required', 'Company A cannot end a Company B break');

reset role;
select throws_ok($$ insert into public.time_entries (
  organization_id, employee_id, location_id, clock_in_at, clock_out_at, status, source, created_by
) select organization_id, employee_id, location_id, '2026-08-17 14:00+00', '2026-08-17 15:00+00',
  'completed', 'system', created_by from public.time_entries where id = '4a600000-0000-0000-0000-000000000001' $$,
  'P0001', 'Employee already has an overlapping time entry', 'Overlapping time entries are rejected by database integrity');
select throws_ok($$ insert into public.time_breaks (organization_id, time_entry_id, start_at, end_at)
  select organization_id, id, '2026-08-17 07:00+00', '2026-08-17 08:00+00'
  from public.time_entries where id = '4a600000-0000-0000-0000-000000000001' $$,
  'P0001', 'Break must fall inside its parent time entry', 'Breaks outside their parent entry are rejected');
select ok((select count(*) > 0 from public.audit_events
  where table_name = 'time_entries' and record_id = '4a600000-0000-0000-0000-000000000001'),
  'Time-entry changes produce audit events');
select ok((select enabled from public.organization_modules module
  join public.organizations organization on organization.id = module.organization_id
  where organization.slug = 'gate4-company-a' and module.module_key = 'time_clock'),
  'Time clock module is enabled for the organization');
select is((select count(*)::integer from public.permissions where capability like 'timeclock.%'), 4,
  'Exactly four Gate 4 time-clock capabilities are registered');

select * from finish();
rollback;
