begin;
select no_plan();

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


-- New tests use existing gate fixtures, in a transaction; no web test is edited.
select set_config('test.org', (select id::text from public.organizations where slug = 'gate4-company-a'), true);
select set_config('test.foreign_org', (select id::text from public.organizations where slug = 'gate4-company-b'), true);
set local role authenticated;
set local "request.jwt.claim.sub" = '4a000000-0000-0000-0000-000000000003';
select is(public.mobile_clock_context(current_setting('test.org')::uuid)->'activeEntry', 'null'::jsonb, 'New employee starts clocked out');
select set_config('test.in_request', gen_random_uuid()::text, true);
select set_config('test.entry', public.mobile_clock_in(
 current_setting('test.org')::uuid, current_setting('test.in_request')::uuid, null,
 '4a200000-0000-0000-0000-000000000001', '4a500000-0000-0000-0000-000000000001', null,
 40.7128, -74.006, 10, '2026-01-01T00:00:00Z'
)->>'timeEntryId', true);
select is((select count(*)::integer from public.time_entries where status='open'), 1, 'Mobile creates one own open entry');
select is((select clock_in_latitude from public.time_entries where status='open'), 40.712800::numeric, 'Clock-in GPS stored');
select is((select shift_id from public.time_entries where status='open'), '4a500000-0000-0000-0000-000000000001'::uuid, 'Existing assigned shift linkage reused');
select ok((select clock_in_at > clock_in_captured_at from public.time_entries where status='open'), 'Device sample time does not control worked time');
select is(public.mobile_clock_in(current_setting('test.org')::uuid, current_setting('test.in_request')::uuid, null,
 '4a200000-0000-0000-0000-000000000001')->>'timeEntryId', current_setting('test.entry'), 'Same clock-in request is idempotent');
select throws_ok($$ select public.mobile_clock_in(current_setting('test.org')::uuid, gen_random_uuid(), null,
 '4a200000-0000-0000-0000-000000000001') $$, '40001', null, 'Stale clock-in snapshot rejected');
select throws_ok($$ select public.mobile_clock_in(current_setting('test.org')::uuid, gen_random_uuid(), current_setting('test.entry')::uuid,
 '4a200000-0000-0000-0000-000000000001') $$, 'P0001', 'Employee already has an open time entry', 'Existing duplicate-open protection reused');
select is(public.mobile_clock_context(current_setting('test.org')::uuid)->'activeEntry'->>'id', current_setting('test.entry'), 'Fresh read restores active entry');

set local "request.jwt.claim.sub" = '4a000000-0000-0000-0000-000000000004';
select is((select count(*)::integer from public.time_entries where id=current_setting('test.entry')::uuid), 0, 'Other employee cannot read punch evidence');
select throws_ok($$ select public.mobile_clock_out(current_setting('test.org')::uuid, gen_random_uuid(), current_setting('test.entry')::uuid) $$,
 '42501', null, 'Other employee cannot close known entry');
select throws_ok($$ update public.time_entries set clock_in_latitude = 0 where id=current_setting('test.entry')::uuid $$,
 '42501', null, 'Direct punch changes remain forbidden');
set local "request.jwt.claim.sub" = '4b000000-0000-0000-0000-000000000001';
select is((select count(*)::integer from public.time_entries where id=current_setting('test.entry')::uuid), 0, 'Foreign organization cannot read known entry');
select throws_ok($$ select public.mobile_clock_context(current_setting('test.org')::uuid) $$, '42501', null, 'Foreign tenant cannot read mobile clock context');
select throws_ok($$ select public.mobile_clock_out(current_setting('test.org')::uuid, gen_random_uuid(), current_setting('test.entry')::uuid) $$, '42501', null, 'Foreign tenant cannot clock out');
select throws_ok($$ select public.mobile_clock_in(current_setting('test.org')::uuid, gen_random_uuid(), null, '4a200000-0000-0000-0000-000000000001') $$, '42501', null, 'Foreign tenant cannot clock in');
set local "request.jwt.claim.sub" = '4a000000-0000-0000-0000-000000000003';
select public.start_break(current_setting('test.org')::uuid);
select is((public.mobile_clock_context(current_setting('test.org')::uuid)->>'hasOpenBreak')::boolean, true, 'Existing break state is visible');
select throws_ok($$ select public.mobile_clock_out(current_setting('test.org')::uuid, gen_random_uuid(), current_setting('test.entry')::uuid) $$,
 'P0001', 'End the active break before clocking out', 'Mobile preserves active-break closure rule');
select public.end_break(current_setting('test.org')::uuid);
select set_config('test.out_request', gen_random_uuid()::text, true);
select is(public.mobile_clock_out(current_setting('test.org')::uuid, current_setting('test.out_request')::uuid, current_setting('test.entry')::uuid,
 40.713, -74.006, 12, clock_timestamp()), current_setting('test.entry')::uuid, 'Clock-out closes exact expected entry');
select is((select status::text from public.time_entries where id=current_setting('test.entry')::uuid), 'completed', 'Existing clock-out completes entry');
select is((select clock_out_latitude from public.time_entries where id=current_setting('test.entry')::uuid), 40.713000::numeric, 'Clock-out GPS stored');
select is(public.mobile_clock_context(current_setting('test.org')::uuid)->'activeEntry', 'null'::jsonb, 'Refresh restores clocked-out status');
select is(public.mobile_clock_out(current_setting('test.org')::uuid, current_setting('test.out_request')::uuid, current_setting('test.entry')::uuid),
 current_setting('test.entry')::uuid, 'Clock-out request is idempotent');
select is(public.mobile_clock_in(current_setting('test.org')::uuid, current_setting('test.in_request')::uuid, null,
 '4a200000-0000-0000-0000-000000000001')->>'timeEntryId', current_setting('test.entry'), 'Replaying closed clock-in never opens a new entry');

select throws_ok($$ select public.mobile_clock_in(current_setting('test.org')::uuid, gen_random_uuid(), current_setting('test.entry')::uuid,
 '4a200000-0000-0000-0000-000000000001', null, null, 95, 1, 10, now()) $$, '22023', null, 'Invalid coordinates rejected');
select throws_ok($$ select public.mobile_clock_in(current_setting('test.org')::uuid, gen_random_uuid(), current_setting('test.entry')::uuid,
 '4a200000-0000-0000-0000-000000000001', null, null, 40, null, 10, now()) $$, '22023', null, 'Partial GPS rejected');
select throws_ok($$ select public.mobile_clock_in(current_setting('test.org')::uuid, gen_random_uuid(), current_setting('test.entry')::uuid,
 '4b200000-0000-0000-0000-000000000001') $$, 'P0001', null, 'Cross-tenant location rejected by existing creation logic');
select throws_ok($$ select public.mobile_clock_in(current_setting('test.org')::uuid, gen_random_uuid(), current_setting('test.entry')::uuid,
 '4a200000-0000-0000-0000-000000000001', expected_employee_id := '4a100000-0000-0000-0000-000000000002') $$, '42501', null, 'Stale account context rejected');
select set_config('test.second', public.mobile_clock_in(current_setting('test.org')::uuid, gen_random_uuid(), current_setting('test.entry')::uuid,
 '4a200000-0000-0000-0000-000000000001')->>'timeEntryId', true);
select ok((select clock_in_latitude is null from public.time_entries where id=current_setting('test.second')::uuid), 'GPS remains optional for standard clock-in');
select throws_ok($$ select public.mobile_clock_out(current_setting('test.org')::uuid, gen_random_uuid(), current_setting('test.entry')::uuid) $$,
 '40001', null, 'Stale clock-out cannot close newer entry');
select is(public.mobile_clock_out(current_setting('test.org')::uuid, current_setting('test.out_request')::uuid, current_setting('test.entry')::uuid),
 current_setting('test.entry')::uuid, 'Old retry returns old receipt while newer entry stays open');
select is((select count(*)::integer from public.time_entries where id=current_setting('test.second')::uuid and status='open'), 1, 'Newer entry remains open');
select lives_ok($$ select public.mobile_clock_out(current_setting('test.org')::uuid, gen_random_uuid(), current_setting('test.second')::uuid) $$, 'GPS remains optional for clock-out');

-- Field verification uses the unchanged existing job/field services.
set local "request.jwt.claim.sub" = '4a000000-0000-0000-0000-000000000001';
select public.field_create_job(current_setting('test.org')::uuid, 'Mobile Test', 'Mobile Field Test',
 '4a200000-0000-0000-0000-000000000001', '4 Time Way', '2026-09-03 09:00', '2026-09-03 17:00', 'scheduled', '');
select set_config('test.job', (select id::text from public.jobs where job_name='Mobile Field Test'), true);
select public.field_update_job_coordinates(current_setting('test.job')::uuid, 40.7128, -74.006);
select public.field_assign_job(current_setting('test.job')::uuid, null, '4a100000-0000-0000-0000-000000000001');
select public.configure_field_clock(current_setting('test.org')::uuid, true, 150, 100, true);
set local "request.jwt.claim.sub" = '4a000000-0000-0000-0000-000000000003';
select is((public.mobile_clock_context(current_setting('test.org')::uuid)->>'fieldRequired')::boolean, true, 'Context reports existing field requirement');
select throws_ok($$ select public.mobile_clock_in(current_setting('test.org')::uuid, gen_random_uuid(), current_setting('test.second')::uuid,
 '4a200000-0000-0000-0000-000000000001') $$, 'P0001', 'Field location verification is required for an assigned job', 'Optional GPS cannot bypass required field verification');
select set_config('test.failed_request', gen_random_uuid()::text, true);
select is(public.mobile_clock_in(current_setting('test.org')::uuid, current_setting('test.failed_request')::uuid, current_setting('test.second')::uuid,
 '4a200000-0000-0000-0000-000000000001', null, current_setting('test.job')::uuid, 41, -74, 10, now())->>'status',
 'outside_radius', 'Wrapper preserves existing field rejection');
select is(public.mobile_clock_in(current_setting('test.org')::uuid, current_setting('test.failed_request')::uuid, current_setting('test.second')::uuid,
 '4a200000-0000-0000-0000-000000000001', null, current_setting('test.job')::uuid, 41, -74, 10, now())->>'status',
 'outside_radius', 'Failed field retry is idempotent');
select is((select count(*)::integer from public.field_clock_verifications where mobile_request_id=current_setting('test.failed_request')::uuid), 1, 'Failed attempt is recorded once');
select set_config('test.field_entry', public.mobile_clock_in(current_setting('test.org')::uuid, gen_random_uuid(), current_setting('test.second')::uuid,
 '4a200000-0000-0000-0000-000000000001', null, current_setting('test.job')::uuid, 40.7128, -74.006, 10, now())->>'timeEntryId', true);
select ok((select clock_in_latitude is not null from public.time_entries where id=current_setting('test.field_entry')::uuid), 'Verified field entry stores punch GPS');
select is((select count(*)::integer from public.field_clock_verifications where time_entry_id=current_setting('test.field_entry')::uuid), 1, 'Existing job verification links to same time entry');
select lives_ok($$ select public.mobile_clock_out(current_setting('test.org')::uuid, gen_random_uuid(), current_setting('test.field_entry')::uuid) $$, 'Existing field clock-out remains GPS optional');
reset role;
select ok(not has_function_privilege('anon', 'public.mobile_clock_context(uuid)', 'EXECUTE'), 'Anonymous caller denied context');
select ok(not has_function_privilege('authenticated', 'public.mobile_validate_punch(numeric,numeric,numeric,timestamptz)', 'EXECUTE'), 'Private GPS validator not callable by client');
select * from finish();
rollback;
