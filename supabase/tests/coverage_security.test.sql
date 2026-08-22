begin;
select plan(49);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'gate3-owner-a@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'gate3-manager-a@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'gate3-employee-a@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'gate3-employee-b@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'gate3-employee-c@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'gate3-owner-b@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

set local role authenticated;
set local "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000001';
select public.create_organization('Gate 3 Company A', 'gate3-company-a', 'America/New_York');

reset role;
insert into public.organization_memberships (organization_id, profile_id, role_id, membership_role, status)
select organization.id, profile.id, role.id, setup.membership_role, 'active'
from (values
  ('e0000000-0000-0000-0000-000000000002'::uuid, 'Manager'::text, 'manager'::public.membership_role),
  ('e0000000-0000-0000-0000-000000000003'::uuid, 'Employee'::text, 'employee'::public.membership_role),
  ('e0000000-0000-0000-0000-000000000004'::uuid, 'Employee'::text, 'employee'::public.membership_role),
  ('e0000000-0000-0000-0000-000000000005'::uuid, 'Employee'::text, 'employee'::public.membership_role)
) setup(auth_user_id, role_name, membership_role)
join public.profiles profile on profile.auth_user_id = setup.auth_user_id
cross join public.organizations organization
join public.roles role on role.organization_id = organization.id and role.name = setup.role_name
where organization.slug = 'gate3-company-a';

insert into public.employees (id, organization_id, profile_id, first_name, last_name, email, created_at)
select setup.employee_id, organization.id, profile.id, setup.first_name, setup.last_name, setup.email, setup.created_at
from (values
  ('e1000000-0000-0000-0000-000000000001'::uuid, 'e0000000-0000-0000-0000-000000000003'::uuid, 'Employee', 'A', 'employee-a@gate3.example', now() - interval '4 minutes'),
  ('e1000000-0000-0000-0000-000000000002'::uuid, 'e0000000-0000-0000-0000-000000000004'::uuid, 'Employee', 'B', 'employee-b@gate3.example', now() - interval '3 minutes'),
  ('e1000000-0000-0000-0000-000000000003'::uuid, 'e0000000-0000-0000-0000-000000000005'::uuid, 'Employee', 'C', 'employee-c@gate3.example', now() - interval '2 minutes'),
  ('e1000000-0000-0000-0000-000000000004'::uuid, 'e0000000-0000-0000-0000-000000000002'::uuid, 'Manager', 'A', 'manager-a@gate3.example', now() - interval '1 minute')
) setup(employee_id, auth_user_id, first_name, last_name, email, created_at)
join public.profiles profile on profile.auth_user_id = setup.auth_user_id
cross join public.organizations organization
where organization.slug = 'gate3-company-a';

insert into public.locations (id, organization_id, name, address, city, state, postal_code)
select 'e2000000-0000-0000-0000-000000000001', id, 'Gate 3 Office', '1 Coverage Way', 'Sampleville', 'NY', '10001'
from public.organizations where slug = 'gate3-company-a';
insert into public.departments (id, organization_id, location_id, name)
select 'e3000000-0000-0000-0000-000000000001', id, 'e2000000-0000-0000-0000-000000000001', 'Operations'
from public.organizations where slug = 'gate3-company-a';
insert into public.schedules (
  id, organization_id, location_id, week_start, status, published_at, published_by, created_by
)
select 'e4000000-0000-0000-0000-000000000001', organization.id,
  'e2000000-0000-0000-0000-000000000001', '2026-09-07', 'published', now(), profile.id, profile.id
from public.organizations organization
join public.profiles profile on profile.auth_user_id = 'e0000000-0000-0000-0000-000000000001'
where organization.slug = 'gate3-company-a';
insert into public.schedules (
  id, organization_id, location_id, week_start, status, created_by
)
select 'e4000000-0000-0000-0000-000000000002', organization.id,
  'e2000000-0000-0000-0000-000000000001', '2026-09-14', 'draft', profile.id
from public.organizations organization
join public.profiles profile on profile.auth_user_id = 'e0000000-0000-0000-0000-000000000001'
where organization.slug = 'gate3-company-a';

insert into public.shifts (
  id, organization_id, schedule_id, location_id, department_id, employee_id,
  start_at, end_at, status, notes, created_by
)
select setup.shift_id, organization.id, setup.schedule_id,
  'e2000000-0000-0000-0000-000000000001', 'e3000000-0000-0000-0000-000000000001',
  setup.employee_id, setup.start_at, setup.end_at, setup.status, setup.notes, profile.id
from (values
  ('e5000000-0000-0000-0000-000000000001'::uuid, 'e4000000-0000-0000-0000-000000000001'::uuid, 'e1000000-0000-0000-0000-000000000003'::uuid, '2026-09-07 13:00+00'::timestamptz, '2026-09-07 21:00+00'::timestamptz, 'published'::public.shift_status, 'Primary open flow'),
  ('e5000000-0000-0000-0000-000000000002'::uuid, 'e4000000-0000-0000-0000-000000000001'::uuid, 'e1000000-0000-0000-0000-000000000003'::uuid, '2026-09-08 13:00+00'::timestamptz, '2026-09-08 21:00+00'::timestamptz, 'published'::public.shift_status, 'Cancellation flow'),
  ('e5000000-0000-0000-0000-000000000003'::uuid, 'e4000000-0000-0000-0000-000000000001'::uuid, 'e1000000-0000-0000-0000-000000000001'::uuid, '2026-09-09 13:00+00'::timestamptz, '2026-09-09 21:00+00'::timestamptz, 'published'::public.shift_status, 'Successful swap'),
  ('e5000000-0000-0000-0000-000000000004'::uuid, 'e4000000-0000-0000-0000-000000000001'::uuid, 'e1000000-0000-0000-0000-000000000002'::uuid, '2026-09-10 13:00+00'::timestamptz, '2026-09-10 21:00+00'::timestamptz, 'published'::public.shift_status, 'Employee B own shift'),
  ('e5000000-0000-0000-0000-000000000005'::uuid, 'e4000000-0000-0000-0000-000000000001'::uuid, 'e1000000-0000-0000-0000-000000000001'::uuid, '2026-09-11 13:00+00'::timestamptz, '2026-09-11 21:00+00'::timestamptz, 'published'::public.shift_status, 'Conflicting swap'),
  ('e5000000-0000-0000-0000-000000000006'::uuid, 'e4000000-0000-0000-0000-000000000001'::uuid, 'e1000000-0000-0000-0000-000000000002'::uuid, '2026-09-11 17:00+00'::timestamptz, '2026-09-11 23:00+00'::timestamptz, 'published'::public.shift_status, 'Existing target conflict'),
  ('e5000000-0000-0000-0000-000000000007'::uuid, 'e4000000-0000-0000-0000-000000000001'::uuid, 'e1000000-0000-0000-0000-000000000001'::uuid, '2026-09-12 13:00+00'::timestamptz, '2026-09-12 21:00+00'::timestamptz, 'published'::public.shift_status, 'Cancelled swap'),
  ('e5000000-0000-0000-0000-000000000008'::uuid, 'e4000000-0000-0000-0000-000000000001'::uuid, 'e1000000-0000-0000-0000-000000000003'::uuid, '2026-09-13 13:00+00'::timestamptz, '2026-09-13 21:00+00'::timestamptz, 'published'::public.shift_status, 'Stale open flow'),
  ('e5000000-0000-0000-0000-000000000009'::uuid, 'e4000000-0000-0000-0000-000000000002'::uuid, null::uuid, '2026-09-14 13:00+00'::timestamptz, '2026-09-14 21:00+00'::timestamptz, 'draft'::public.shift_status, 'Draft invisible')
) setup(shift_id, schedule_id, employee_id, start_at, end_at, status, notes)
cross join public.organizations organization
join public.profiles profile on profile.auth_user_id = 'e0000000-0000-0000-0000-000000000001'
where organization.slug = 'gate3-company-a';

set local role authenticated;
set local "request.jwt.claim.sub" = 'f0000000-0000-0000-0000-000000000001';
select public.create_organization('Gate 3 Company B', 'gate3-company-b', 'America/Chicago');
reset role;
insert into public.employees (id, organization_id, first_name, last_name, email)
select 'f1000000-0000-0000-0000-000000000001', id, 'Company', 'B Employee', 'company-b-employee@gate3.example'
from public.organizations where slug = 'gate3-company-b';
insert into public.locations (id, organization_id, name, address, city, state, postal_code)
select 'f2000000-0000-0000-0000-000000000001', id, 'Company B Office', '2 Other Way', 'Elsewhere', 'IL', '60001'
from public.organizations where slug = 'gate3-company-b';
insert into public.departments (id, organization_id, location_id, name)
select 'f3000000-0000-0000-0000-000000000001', id, 'f2000000-0000-0000-0000-000000000001', 'Company B Ops'
from public.organizations where slug = 'gate3-company-b';
insert into public.schedules (id, organization_id, location_id, week_start, status, published_at, published_by, created_by)
select 'f4000000-0000-0000-0000-000000000001', organization.id,
  'f2000000-0000-0000-0000-000000000001', '2026-09-07', 'published', now(), profile.id, profile.id
from public.organizations organization
join public.profiles profile on profile.auth_user_id = 'f0000000-0000-0000-0000-000000000001'
where organization.slug = 'gate3-company-b';
insert into public.shifts (
  id, organization_id, schedule_id, location_id, department_id, employee_id,
  start_at, end_at, status, notes, created_by
)
select 'f5000000-0000-0000-0000-000000000001', organization.id,
  'f4000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001',
  'f3000000-0000-0000-0000-000000000001', null, '2026-09-07 14:00+00', '2026-09-07 22:00+00',
  'open', 'Company B open shift', profile.id
from public.organizations organization
join public.profiles profile on profile.auth_user_id = 'f0000000-0000-0000-0000-000000000001'
where organization.slug = 'gate3-company-b';
insert into public.open_shift_requests (
  id, organization_id, shift_id, employee_id, shift_updated_at
)
select 'f6000000-0000-0000-0000-000000000001', organization_id, id,
  'f1000000-0000-0000-0000-000000000001', updated_at
from public.shifts where id = 'f5000000-0000-0000-0000-000000000001';
insert into public.shift_swap_requests (
  id, organization_id, shift_id, requesting_employee_id, target_employee_id, shift_updated_at
)
select 'f7000000-0000-0000-0000-000000000001', organization_id, id,
  'f1000000-0000-0000-0000-000000000001', null, updated_at
from public.shifts where id = 'f5000000-0000-0000-0000-000000000001';

set local role authenticated;
set local "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000003';
select ok(public.has_permission((select id from public.organizations where slug = 'gate3-company-a'), 'open_shift.view'), 'Employee receives open_shift.view');
select ok(public.has_permission((select id from public.organizations where slug = 'gate3-company-a'), 'open_shift.request'), 'Employee receives open_shift.request');
select ok(public.has_permission((select id from public.organizations where slug = 'gate3-company-a'), 'shift_swap.request'), 'Employee receives shift_swap.request');
select ok(not public.has_permission((select id from public.organizations where slug = 'gate3-company-a'), 'open_shift.manage'), 'Employee does not receive open_shift.manage');
select ok(not public.has_permission((select id from public.organizations where slug = 'gate3-company-a'), 'shift_swap.approve'), 'Employee does not receive shift_swap.approve');
set local "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000002';
select ok(public.has_permission((select id from public.organizations where slug = 'gate3-company-a'), 'open_shift.manage'), 'Manager receives open_shift.manage');
select ok(public.has_permission((select id from public.organizations where slug = 'gate3-company-a'), 'shift_swap.approve'), 'Manager receives shift_swap.approve');

select lives_ok($$ select public.scheduling_mark_shift_open('e5000000-0000-0000-0000-000000000001') $$, 'Manager can mark a published shift open');
select is((select status::text from public.shifts where id = 'e5000000-0000-0000-0000-000000000001'), 'open', 'Marked shift has open status');

set local "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000003';
select is((select count(*)::integer from public.shifts where id = 'e5000000-0000-0000-0000-000000000001'), 1, 'Employee can see an eligible open shift');
select is((select count(*)::integer from public.shifts where id = 'e5000000-0000-0000-0000-000000000009'), 0, 'Employee cannot see a draft shift');
select lives_ok($$ select public.create_my_open_shift_request(
  (select id from public.organizations where slug = 'gate3-company-a'), 'e5000000-0000-0000-0000-000000000001'
) $$, 'Employee can create an own open-shift request');
select is((select status::text from public.open_shift_requests where shift_id = 'e5000000-0000-0000-0000-000000000001'), 'pending', 'Open-shift request starts pending');
select throws_ok($$ select public.create_my_open_shift_request(
  (select id from public.organizations where slug = 'gate3-company-a'), 'e5000000-0000-0000-0000-000000000001'
) $$, 'P0001', 'A pending request already exists for this shift', 'Duplicate active open-shift request is rejected');
select throws_ok($$ select public.scheduling_approve_open_shift_request(
  (select id from public.open_shift_requests where shift_id = 'e5000000-0000-0000-0000-000000000001'), ''
) $$, '42501', 'Open-shift management permission required', 'Employee cannot approve an open-shift request');

set local "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000004';
select public.create_my_open_shift_request(
  (select id from public.organizations where slug = 'gate3-company-a'), 'e5000000-0000-0000-0000-000000000001'
);
set local "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000002';
select lives_ok($$ select public.scheduling_approve_open_shift_request(
  (select id from public.open_shift_requests where shift_id = 'e5000000-0000-0000-0000-000000000001' and employee_id = 'e1000000-0000-0000-0000-000000000001'), 'Approved'
) $$, 'Manager can approve an open-shift request');
select is((select employee_id from public.shifts where id = 'e5000000-0000-0000-0000-000000000001'), 'e1000000-0000-0000-0000-000000000001'::uuid, 'Approval assigns the requesting employee');
select is((select status::text from public.shifts where id = 'e5000000-0000-0000-0000-000000000001'), 'published', 'Approved open shift is no longer claimable');
select is((select status::text from public.open_shift_requests where shift_id = 'e5000000-0000-0000-0000-000000000001' and employee_id = 'e1000000-0000-0000-0000-000000000002'), 'denied', 'Competing pending request is retired atomically');
select throws_ok($$ select public.scheduling_approve_open_shift_request(
  (select id from public.open_shift_requests where shift_id = 'e5000000-0000-0000-0000-000000000001' and employee_id = 'e1000000-0000-0000-0000-000000000002'), ''
) $$, 'P0001', 'Only pending open-shift requests can be approved', 'Second approval for the same shift fails safely');

select public.scheduling_mark_shift_open('e5000000-0000-0000-0000-000000000002');
set local "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000003';
select public.create_my_open_shift_request((select id from public.organizations where slug = 'gate3-company-a'), 'e5000000-0000-0000-0000-000000000002');
select lives_ok($$ select public.cancel_my_open_shift_request(
  (select id from public.open_shift_requests where shift_id = 'e5000000-0000-0000-0000-000000000002')
) $$, 'Employee can cancel an own pending open-shift request');
select is((select status::text from public.open_shift_requests where shift_id = 'e5000000-0000-0000-0000-000000000002'), 'cancelled', 'Open-shift cancellation is persisted');
set local "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000004';
select public.create_my_open_shift_request((select id from public.organizations where slug = 'gate3-company-a'), 'e5000000-0000-0000-0000-000000000002');
set local "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000002';
select lives_ok($$ select public.review_open_shift_request(
  (select id from public.open_shift_requests where shift_id = 'e5000000-0000-0000-0000-000000000002' and status = 'pending'), 'denied', 'Not needed'
) $$, 'Manager can deny a pending open-shift request');
select is((select status::text from public.open_shift_requests where shift_id = 'e5000000-0000-0000-0000-000000000002' and employee_id = 'e1000000-0000-0000-0000-000000000002'), 'denied', 'Open-shift denial is persisted');
select public.publish_weekly_schedule('e4000000-0000-0000-0000-000000000001');
select is((select status::text from public.shifts where id = 'e5000000-0000-0000-0000-000000000002'), 'open', 'Republishing preserves an existing open shift');

set local "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000002';
select public.scheduling_mark_shift_open('e5000000-0000-0000-0000-000000000008');
set local "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000003';
select public.create_my_open_shift_request((select id from public.organizations where slug = 'gate3-company-a'), 'e5000000-0000-0000-0000-000000000008');
reset role;
update public.shifts set status = 'draft' where id = 'e5000000-0000-0000-0000-000000000008';
set local role authenticated;
set local "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000002';
select throws_ok($$ select public.scheduling_approve_open_shift_request(
  (select id from public.open_shift_requests where shift_id = 'e5000000-0000-0000-0000-000000000008'), ''
) $$, 'P0001', 'Open shift changed after the request was submitted', 'Stale open-shift approval fails safely');

set local "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000001';
select is((select count(*)::integer from public.open_shift_requests where id = 'f6000000-0000-0000-0000-000000000001'), 0, 'Company A cannot read Company B open-shift requests');
select throws_ok($$ select public.create_my_open_shift_request(
  (select id from public.organizations where slug = 'gate3-company-b'), 'f5000000-0000-0000-0000-000000000001'
) $$, '42501', 'Open-shift request permission required', 'Company A cannot create a request for a Company B shift');
select throws_ok($$ update public.open_shift_requests set manager_note = 'Compromised' where id = 'f6000000-0000-0000-0000-000000000001' $$, '42501', null, 'Company A cannot update Company B open-shift requests');
select throws_ok($$ select public.scheduling_approve_open_shift_request('f6000000-0000-0000-0000-000000000001', '') $$, '42501', 'Open-shift management permission required', 'Company A cannot approve Company B open-shift requests');
select throws_ok($$ delete from public.open_shift_requests where id = 'f6000000-0000-0000-0000-000000000001' $$, '42501', null, 'Company A cannot delete Company B open-shift requests');

set local "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000003';
select lives_ok($$ select public.create_my_shift_swap_request(
  (select id from public.organizations where slug = 'gate3-company-a'), 'e5000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000002'
) $$, 'Employee can request a swap for an own assigned published shift');
select throws_ok($$ select public.create_my_shift_swap_request(
  (select id from public.organizations where slug = 'gate3-company-a'), 'e5000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000003'
) $$, 'P0001', 'Only your own upcoming published shift can be swapped', 'Employee cannot request a swap for another employee shift');
select throws_ok($$ select public.create_my_shift_swap_request(
  (select id from public.organizations where slug = 'gate3-company-a'), 'e5000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000002'
) $$, 'P0001', 'A pending swap request already exists for this shift', 'Duplicate active swap request is rejected');
select throws_ok($$ select public.scheduling_approve_shift_swap(
  (select id from public.shift_swap_requests where shift_id = 'e5000000-0000-0000-0000-000000000003'), ''
) $$, '42501', 'Shift-swap approval permission required', 'Employee cannot approve a shift swap');
select throws_ok($$ select public.create_my_shift_swap_request(
  (select id from public.organizations where slug = 'gate3-company-a'), 'e5000000-0000-0000-0000-000000000007', 'f1000000-0000-0000-0000-000000000001'
) $$, 'P0001', 'Swap target must be another active employee in the organization', 'Target employee from another organization is rejected');

set local "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000002';
select lives_ok($$ select public.scheduling_approve_shift_swap(
  (select id from public.shift_swap_requests where shift_id = 'e5000000-0000-0000-0000-000000000003'), 'Approved swap'
) $$, 'Manager can approve a valid swap');
select is((select employee_id from public.shifts where id = 'e5000000-0000-0000-0000-000000000003'), 'e1000000-0000-0000-0000-000000000002'::uuid, 'Approved swap changes assignment through Scheduling');
select is((select status::text from public.shift_swap_requests where shift_id = 'e5000000-0000-0000-0000-000000000003'), 'approved', 'Approved swap status is persisted');

set local "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000003';
select public.create_my_shift_swap_request(
  (select id from public.organizations where slug = 'gate3-company-a'), 'e5000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000002'
);
set local "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000002';
select throws_ok($$ select public.scheduling_approve_shift_swap(
  (select id from public.shift_swap_requests where shift_id = 'e5000000-0000-0000-0000-000000000005'), ''
) $$, 'P0001', 'Employee already has an overlapping shift', 'Overlap conflict prevents invalid swap approval');

set local "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000003';
select public.create_my_shift_swap_request(
  (select id from public.organizations where slug = 'gate3-company-a'), 'e5000000-0000-0000-0000-000000000007', 'e1000000-0000-0000-0000-000000000003'
);
select lives_ok($$ select public.cancel_my_shift_swap_request(
  (select id from public.shift_swap_requests where shift_id = 'e5000000-0000-0000-0000-000000000007')
) $$, 'Employee can cancel an own pending swap');
select is((select status::text from public.shift_swap_requests where shift_id = 'e5000000-0000-0000-0000-000000000007'), 'cancelled', 'Swap cancellation is persisted');
select public.create_my_shift_swap_request(
  (select id from public.organizations where slug = 'gate3-company-a'), 'e5000000-0000-0000-0000-000000000007', 'e1000000-0000-0000-0000-000000000003'
);
set local "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000002';
select lives_ok($$ select public.review_shift_swap_request(
  (select id from public.shift_swap_requests where shift_id = 'e5000000-0000-0000-0000-000000000007' and status = 'pending'), 'denied', 'Coverage retained'
) $$, 'Manager can deny a pending shift swap');
select is((select status::text from public.shift_swap_requests where shift_id = 'e5000000-0000-0000-0000-000000000007' and status = 'denied'), 'denied', 'Shift-swap denial is persisted');

set local "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000001';
select is((select count(*)::integer from public.shift_swap_requests where id = 'f7000000-0000-0000-0000-000000000001'), 0, 'Company A cannot read Company B swap requests');
select throws_ok($$ select public.create_my_shift_swap_request(
  (select id from public.organizations where slug = 'gate3-company-b'), 'f5000000-0000-0000-0000-000000000001', null
) $$, '42501', 'Shift-swap request permission required', 'Company A cannot create a swap for a Company B shift');
select throws_ok($$ update public.shift_swap_requests set manager_note = 'Compromised' where id = 'f7000000-0000-0000-0000-000000000001' $$, '42501', null, 'Company A cannot update Company B swaps');
select throws_ok($$ select public.scheduling_approve_shift_swap('f7000000-0000-0000-0000-000000000001', '') $$, '42501', 'Shift-swap approval permission required', 'Company A cannot approve Company B swaps');
select throws_ok($$ delete from public.shift_swap_requests where id = 'f7000000-0000-0000-0000-000000000001' $$, '42501', null, 'Company A cannot delete Company B swaps');

select * from finish();
rollback;
