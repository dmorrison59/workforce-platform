begin;
select plan(60);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '7a000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'gate7-owner-a@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '7a000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'gate7-manager-a@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '7a000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'gate7-employee-a@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '7a000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'gate7-employee-b@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '7b000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'gate7-owner-b@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

set local role authenticated;
set local "request.jwt.claim.sub" = '7a000000-0000-0000-0000-000000000001';
select public.create_organization('Gate 7 Company A', 'gate7-company-a', 'America/New_York');
set local "request.jwt.claim.sub" = '7b000000-0000-0000-0000-000000000001';
select public.create_organization('Gate 7 Company B', 'gate7-company-b', 'America/Chicago');

reset role;
insert into public.organization_memberships (organization_id, profile_id, role_id, membership_role, status)
select organization.id, profile.id, role.id, setup.membership_role, 'active'
from (values
  ('7a000000-0000-0000-0000-000000000002'::uuid, 'Manager'::text, 'manager'::public.membership_role),
  ('7a000000-0000-0000-0000-000000000003'::uuid, 'Employee'::text, 'employee'::public.membership_role),
  ('7a000000-0000-0000-0000-000000000004'::uuid, 'Employee'::text, 'employee'::public.membership_role)
) setup(auth_user_id, role_name, membership_role)
join public.profiles profile on profile.auth_user_id = setup.auth_user_id
cross join public.organizations organization
join public.roles role on role.organization_id = organization.id and role.name = setup.role_name
where organization.slug = 'gate7-company-a';

insert into public.employees (id, organization_id, profile_id, first_name, last_name, email)
select setup.employee_id, organization.id, profile.id, setup.first_name, setup.last_name, setup.email
from (values
  ('7a100000-0000-0000-0000-000000000001'::uuid, '7a000000-0000-0000-0000-000000000003'::uuid, 'Avery', 'Field', 'avery@gate7.example'),
  ('7a100000-0000-0000-0000-000000000002'::uuid, '7a000000-0000-0000-0000-000000000004'::uuid, 'Blake', 'Unassigned', 'blake@gate7.example')
) setup(employee_id, auth_user_id, first_name, last_name, email)
join public.profiles profile on profile.auth_user_id = setup.auth_user_id
cross join public.organizations organization where organization.slug = 'gate7-company-a';
insert into public.employees (id, organization_id, first_name, last_name, email)
select '7b100000-0000-0000-0000-000000000001', id, 'Bailey', 'Foreign', 'bailey@gate7.example'
from public.organizations where slug = 'gate7-company-b';
insert into public.locations (id, organization_id, name, address, city, state, postal_code)
select '7a200000-0000-0000-0000-000000000001', id, 'Field Office A', '1 Main St', 'New York', 'NY', '10001'
from public.organizations where slug = 'gate7-company-a';
insert into public.locations (id, organization_id, name, address, city, state, postal_code)
select '7b200000-0000-0000-0000-000000000001', id, 'Field Office B', '2 Other St', 'Chicago', 'IL', '60001'
from public.organizations where slug = 'gate7-company-b';

set local role authenticated;
set local "request.jwt.claim.sub" = '7a000000-0000-0000-0000-000000000002';
select public.field_create_job(
  (select id from public.organizations where slug = 'gate7-company-a'), 'Acme', 'GPS Job A',
  '7a200000-0000-0000-0000-000000000001', '10 Field Way',
  '2026-08-22 09:00', '2026-08-22 17:00', 'scheduled', ''
);
select public.field_update_job_coordinates((select id from public.jobs where job_name = 'GPS Job A'), 40.712800, -74.006000);
select public.field_assign_job((select id from public.jobs where job_name = 'GPS Job A'), null, '7a100000-0000-0000-0000-000000000001');
select public.field_create_crew(
  (select id from public.organizations where slug = 'gate7-company-a'), 'GPS Crew', null
);
select public.field_add_crew_member(
  (select id from public.crews where name = 'GPS Crew'),
  '7a100000-0000-0000-0000-000000000001', '2026-08-01', null
);
select public.field_create_job(
  (select id from public.organizations where slug = 'gate7-company-a'), 'Acme', 'Crew GPS Job',
  '7a200000-0000-0000-0000-000000000001', '11 Field Way',
  '2026-08-22 09:00', '2026-08-22 17:00', 'scheduled', ''
);
select public.field_update_job_coordinates((select id from public.jobs where job_name = 'Crew GPS Job'), 40.712800, -74.006000);
select public.field_assign_job(
  (select id from public.jobs where job_name = 'Crew GPS Job'),
  (select id from public.crews where name = 'GPS Crew'), null
);
select public.field_create_job(
  (select id from public.organizations where slug = 'gate7-company-a'), 'Acme', 'Cancelled GPS Job',
  '7a200000-0000-0000-0000-000000000001', '12 Field Way',
  '2026-08-22 09:00', '2026-08-22 17:00', 'scheduled', ''
);
select public.field_update_job_coordinates((select id from public.jobs where job_name = 'Cancelled GPS Job'), 40.712800, -74.006000);
select public.field_assign_job((select id from public.jobs where job_name = 'Cancelled GPS Job'), null, '7a100000-0000-0000-0000-000000000001');
select public.field_change_job_status((select id from public.jobs where job_name = 'Cancelled GPS Job'), 'cancelled');
select public.configure_field_clock(
  (select id from public.organizations where slug = 'gate7-company-a'), true, 150, 100, true
);

set local "request.jwt.claim.sub" = '7b000000-0000-0000-0000-000000000001';
select public.field_create_job(
  (select id from public.organizations where slug = 'gate7-company-b'), 'Other', 'GPS Job B',
  '7b200000-0000-0000-0000-000000000001', '20 Foreign Way',
  '2026-08-22 09:00', '2026-08-22 17:00', 'scheduled', ''
);
select public.field_update_job_coordinates((select id from public.jobs where job_name = 'GPS Job B'), 41.878100, -87.629800);

reset role;
insert into public.field_clock_verifications (
  id, organization_id, employee_id, job_id,
  submitted_latitude, submitted_longitude, submitted_accuracy_m,
  expected_latitude, expected_longitude, allowed_radius_m,
  calculated_distance_m, initial_status, status
) select
  '7b700000-0000-0000-0000-000000000001', organization.id,
  '7b100000-0000-0000-0000-000000000001', job.id,
  41.900000, -87.629800, 10, 41.878100, -87.629800, 150,
  2435, 'outside_radius', 'outside_radius'
from public.organizations organization
join public.jobs job on job.organization_id = organization.id and job.job_name = 'GPS Job B'
where organization.slug = 'gate7-company-b';

set local role authenticated;
set local "request.jwt.claim.sub" = '7a000000-0000-0000-0000-000000000001';
select ok(public.has_permission((select id from public.organizations where slug = 'gate7-company-a'), 'field_clock.use'), 'Owner receives field_clock.use');
select ok(public.has_permission((select id from public.organizations where slug = 'gate7-company-a'), 'field_clock.manage'), 'Owner receives field_clock.manage');
select ok(public.has_permission((select id from public.organizations where slug = 'gate7-company-a'), 'field_clock.override'), 'Owner receives field_clock.override');
set local "request.jwt.claim.sub" = '7a000000-0000-0000-0000-000000000002';
select ok(public.has_permission((select id from public.organizations where slug = 'gate7-company-a'), 'field_clock.use'), 'Manager receives field_clock.use');
select ok(public.has_permission((select id from public.organizations where slug = 'gate7-company-a'), 'field_clock.manage'), 'Manager receives field_clock.manage');
select ok(public.has_permission((select id from public.organizations where slug = 'gate7-company-a'), 'field_clock.override'), 'Manager receives field_clock.override');
set local "request.jwt.claim.sub" = '7a000000-0000-0000-0000-000000000003';
select ok(public.has_permission((select id from public.organizations where slug = 'gate7-company-a'), 'field_clock.use'), 'Employee receives field_clock.use');
select ok(not public.has_permission((select id from public.organizations where slug = 'gate7-company-a'), 'field_clock.manage'), 'Employee lacks field_clock.manage');
select ok(not public.has_permission((select id from public.organizations where slug = 'gate7-company-a'), 'field_clock.override'), 'Employee lacks field_clock.override');
select throws_ok($$ select public.clock_in(
  (select id from public.organizations where slug = 'gate7-company-a'),
  '7a200000-0000-0000-0000-000000000001', null
) $$, 'P0001', 'Field location verification is required for an assigned job', 'Assigned field employee cannot bypass verification through standard clock-in');

set local "request.jwt.claim.sub" = '7a000000-0000-0000-0000-000000000004';
select isnt(public.clock_in(
  (select id from public.organizations where slug = 'gate7-company-a'),
  '7a200000-0000-0000-0000-000000000001', null
), null, 'Unassigned office employee retains standard clock-in when field policy is enabled');
select lives_ok($$ select public.clock_out((select id from public.organizations where slug = 'gate7-company-a')) $$, 'Unassigned office employee retains standard clock-out');

reset role;
select is(round(public.field_clock_distance_m(40.7128, -74.006, 40.7128, -74.006), 2), 0.00::numeric, 'Haversine distance is zero for identical points');
select ok(public.field_clock_distance_m(40.7128, -74.006, 40.7137, -74.006) between 99 and 101, 'Haversine calculates a known 100 meter distance');

set local role authenticated;
set local "request.jwt.claim.sub" = '7a000000-0000-0000-0000-000000000003';
select is(
  (public.field_clock_attempt(
    (select id from public.organizations where slug = 'gate7-company-a'),
    (select id from public.jobs where job_name = 'GPS Job A'),
    '7a200000-0000-0000-0000-000000000001', null, 40.712810, -74.006010, 12
  )->>'status'), 'verified', 'Inside-radius attempt is verified'
);
select is((select count(*)::integer from public.time_entries where employee_id = '7a100000-0000-0000-0000-000000000001' and status = 'open'), 1, 'Verified attempt creates one open time entry');
select is((select count(*)::integer from public.field_clock_verifications where status = 'verified' and time_entry_id is not null), 1, 'Verified evidence links to its time entry');
select lives_ok($$ select public.clock_out((select id from public.organizations where slug = 'gate7-company-a')) $$, 'Existing Gate 4 clock-out closes verified field time');

select is(
  (public.field_clock_attempt(
    (select id from public.organizations where slug = 'gate7-company-a'),
    (select id from public.jobs where job_name = 'Crew GPS Job'),
    '7a200000-0000-0000-0000-000000000001', null, 40.712810, -74.006010, 12
  )->>'status'), 'verified', 'Active effective-dated crew assignment authorizes field verification'
);
select is((select count(*)::integer from public.time_entries where employee_id = '7a100000-0000-0000-0000-000000000001'), 2, 'Crew-authorized verification creates a time entry through Gate 4');
select public.clock_out((select id from public.organizations where slug = 'gate7-company-a'));

set local "request.jwt.claim.sub" = '7a000000-0000-0000-0000-000000000002';
select lives_ok($$ select public.field_end_crew_membership(
  (select id from public.crew_members where crew_id = (select id from public.crews where name = 'GPS Crew')),
  '2026-08-21'
) $$, 'Manager ends crew membership without changing prior assignment history');
set local "request.jwt.claim.sub" = '7a000000-0000-0000-0000-000000000003';
select throws_ok($$ select public.field_clock_attempt(
  (select id from public.organizations where slug = 'gate7-company-a'),
  (select id from public.jobs where job_name = 'Crew GPS Job'),
  '7a200000-0000-0000-0000-000000000001', null, 40.7128, -74.006, 10
) $$, '42501', 'Choose an assigned scheduled or in-progress job', 'Expired crew membership no longer authorizes field verification');
select throws_ok($$ select public.field_clock_attempt(
  (select id from public.organizations where slug = 'gate7-company-a'),
  (select id from public.jobs where job_name = 'Cancelled GPS Job'),
  '7a200000-0000-0000-0000-000000000001', null, 40.7128, -74.006, 10
) $$, '42501', 'Choose an assigned scheduled or in-progress job', 'Cancelled job cannot authorize field verification');

select is(
  (public.field_clock_attempt(
    (select id from public.organizations where slug = 'gate7-company-a'),
    (select id from public.jobs where job_name = 'GPS Job A'),
    '7a200000-0000-0000-0000-000000000001', null, 40.722800, -74.006000, 10
  )->>'status'), 'outside_radius', 'Outside-radius attempt is blocked and classified'
);
select is((select count(*)::integer from public.time_entries where employee_id = '7a100000-0000-0000-0000-000000000001'), 2, 'Outside-radius failure creates no time entry');
select ok((select calculated_distance_m > allowed_radius_m from public.field_clock_verifications where status = 'outside_radius'), 'Outside evidence stores a distance beyond the radius');
select is((select submitted_latitude from public.field_clock_verifications where status = 'outside_radius'), 40.7228000::numeric, 'Submitted latitude is snapshotted');
select is((select expected_latitude from public.field_clock_verifications where status = 'outside_radius'), 40.712800::numeric, 'Expected job latitude is snapshotted');

select is(
  (public.field_clock_attempt(
    (select id from public.organizations where slug = 'gate7-company-a'),
    (select id from public.jobs where job_name = 'GPS Job A'),
    '7a200000-0000-0000-0000-000000000001', null, 40.712810, -74.006010, 250
  )->>'status'), 'low_accuracy', 'Low-accuracy attempt is blocked and classified'
);
select is((select count(*)::integer from public.time_entries where employee_id = '7a100000-0000-0000-0000-000000000001'), 2, 'Low-accuracy failure creates no time entry');
select throws_ok($$ select public.configure_field_clock(
  (select id from public.organizations where slug = 'gate7-company-a'), false, 150, 100, true
) $$, '42501', 'Field-clock management permission required', 'Employee cannot configure field clock');
select throws_ok($$ select public.override_field_clock_verification(
  (select id from public.field_clock_verifications where status = 'outside_radius'), 'Employee bypass'
) $$, '42501', 'Field-clock override permission required', 'Employee cannot override failure');
select throws_ok($$ select public.field_clock_attempt(
  (select id from public.organizations where slug = 'gate7-company-a'),
  (select id from public.jobs where job_name = 'GPS Job B'),
  '7a200000-0000-0000-0000-000000000001', null, 40.7128, -74.006, 10
) $$, '42501', 'Choose an assigned scheduled or in-progress job', 'Employee cannot submit against another tenant job');

set local "request.jwt.claim.sub" = '7a000000-0000-0000-0000-000000000004';
select throws_ok($$ select public.field_clock_attempt(
  (select id from public.organizations where slug = 'gate7-company-a'),
  (select id from public.jobs where job_name = 'GPS Job A'),
  '7a200000-0000-0000-0000-000000000001', null, 40.7128, -74.006, 10
) $$, '42501', 'Choose an assigned scheduled or in-progress job', 'Unassigned employee cannot verify at the job');
select is((select count(*)::integer from public.field_clock_verifications), 0, 'Unassigned employee cannot read another employee verification data');

set local "request.jwt.claim.sub" = '7a000000-0000-0000-0000-000000000002';
select is((select count(*)::integer from public.field_clock_verifications), 4, 'Manager reads all own-tenant verification attempts');
select is((select count(*)::integer from public.field_clock_verifications where organization_id = (select id from public.organizations where slug = 'gate7-company-b')), 0, 'Manager cannot read another tenant verification data');
select is((select count(*)::integer from public.field_clock_settings where organization_id = (select id from public.organizations where slug = 'gate7-company-b')), 0, 'Manager cannot read another tenant field-clock settings');
select throws_ok($$ select public.configure_field_clock(
  (select id from public.organizations where slug = 'gate7-company-b'), true, 5000, 1000, true
) $$, '42501', 'Field-clock management permission required', 'Manager cannot alter another tenant field-clock settings');
select throws_ok($$ select public.override_field_clock_verification(
  '7b700000-0000-0000-0000-000000000001', 'Cross-tenant override'
) $$, '42501', 'Field-clock override permission required', 'Manager cannot override another tenant verification');
select lives_ok($$ select public.override_field_clock_verification(
  (select id from public.field_clock_verifications where status = 'outside_radius'), 'Supervisor confirmed employee at the correct entrance'
) $$, 'Manager can override failed verification with a reason');
select is((select initial_status::text from public.field_clock_verifications where status = 'overridden'), 'outside_radius', 'Override preserves the original failure status');
select ok((select overridden_by is not null and overridden_at is not null and char_length(override_reason) > 0 from public.field_clock_verifications where status = 'overridden'), 'Override stores manager and reason audit state');
select throws_ok($$ select public.override_field_clock_verification(
  (select id from public.field_clock_verifications where status = 'verified' limit 1), 'Invalid override'
) $$, 'P0001', 'Only an unresolved failed verification can be overridden', 'Verified attempt cannot be overridden');

set local "request.jwt.claim.sub" = '7a000000-0000-0000-0000-000000000003';
select isnt(public.field_clock_in_with_override(
  (select id from public.field_clock_verifications where status = 'overridden'),
  '7a200000-0000-0000-0000-000000000001', null
), null, 'Employee explicitly clocks in using approved override');
select is((select count(*)::integer from public.field_clock_verifications where status = 'overridden' and time_entry_id is not null), 1, 'Used override links to one time entry');
select throws_ok($$ select public.field_clock_in_with_override(
  (select id from public.field_clock_verifications where status = 'overridden'),
  '7a200000-0000-0000-0000-000000000001', null
) $$, 'P0001', 'An unused approved override is required', 'Used override cannot be replayed');
select lives_ok($$ select public.clock_out((select id from public.organizations where slug = 'gate7-company-a')) $$, 'Employee closes override-backed time through Gate 4');

set local "request.jwt.claim.sub" = '7a000000-0000-0000-0000-000000000002';
select lives_ok($$ select public.configure_field_clock(
  (select id from public.organizations where slug = 'gate7-company-a'), false, 150, 100, true
) $$, 'Manager can disable optional field verification');
set local "request.jwt.claim.sub" = '7a000000-0000-0000-0000-000000000003';
select is(
  (public.field_clock_attempt(
    (select id from public.organizations where slug = 'gate7-company-a'),
    (select id from public.jobs where job_name = 'GPS Job A'),
    '7a200000-0000-0000-0000-000000000001', null, 40.722800, -74.006000, 250
  )->>'status'), 'not_required', 'Disabled field verification records not-required and permits clock-in'
);
select is((select count(*)::integer from public.field_clock_verifications where status = 'not_required' and time_entry_id is not null), 1, 'Not-required evidence links to its Gate 4 time entry');

select throws_ok($$ insert into public.field_clock_verifications (
  organization_id, employee_id, job_id, submitted_latitude, submitted_longitude,
  submitted_accuracy_m, expected_latitude, expected_longitude, allowed_radius_m,
  calculated_distance_m, initial_status, status
) select organization_id, employee_id, job_id, 0, 0, 1, 0, 0, 100, 0, 'verified', 'verified'
from public.field_clock_verifications limit 1 $$, '42501', null, 'Direct verification writes cannot bypass the service');
select throws_ok($$ update public.field_clock_settings set allowed_radius_m = 5000 $$, '42501', null, 'Direct settings writes cannot bypass the service');
select throws_ok($$ update public.jobs set latitude = 0 where job_name = 'GPS Job A' $$, '42501', null, 'Employee cannot directly change job verification coordinates');

reset role;
select ok((select enabled from public.organization_modules module join public.organizations organization on organization.id = module.organization_id where organization.slug = 'gate7-company-a' and module.module_key = 'gps'), 'GPS module is enabled');
select is((select count(*)::integer from public.permissions where capability like 'field_clock.%'), 3, 'Exactly three Gate 7 capabilities are registered');
select ok((select count(*) > 0 from public.audit_events where table_name = 'field_clock_verifications'), 'Verification changes produce audit events');
select ok((select count(*) > 0 from public.audit_events where table_name = 'field_clock_settings'), 'Settings changes produce audit events');
select is((select count(*)::integer from public.organizations organization where not exists (
  select 1 from public.field_clock_settings setting where setting.organization_id = organization.id
)), 0, 'Every tenant has one field-clock settings row');
select ok((select count(*) = 0 from public.field_clock_verifications where status in ('outside_radius', 'low_accuracy') and time_entry_id is not null), 'Failed verifications never link to time entries');

select * from finish();
rollback;
