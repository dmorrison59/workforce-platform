begin;
select plan(37);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'gate2-owner-a@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'gate2-manager-a@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'gate2-employee-a@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'gate2-employee-b@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'gate2-owner-company-b@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

set local role authenticated;
set local "request.jwt.claim.sub" = 'c0000000-0000-0000-0000-000000000001';
select public.create_organization('Gate 2 Company A', 'gate2-company-a', 'America/New_York');

reset role;
insert into public.organization_memberships (organization_id, profile_id, role_id, membership_role, status)
select organization.id, profile.id, role.id, membership_role, 'active'
from (values
  ('c0000000-0000-0000-0000-000000000002'::uuid, 'Manager'::text, 'manager'::public.membership_role),
  ('c0000000-0000-0000-0000-000000000003'::uuid, 'Employee'::text, 'employee'::public.membership_role),
  ('c0000000-0000-0000-0000-000000000004'::uuid, 'Employee'::text, 'employee'::public.membership_role)
) setup(auth_user_id, role_name, membership_role)
join public.profiles profile on profile.auth_user_id = setup.auth_user_id
cross join public.organizations organization
join public.roles role on role.organization_id = organization.id and role.name = setup.role_name
where organization.slug = 'gate2-company-a';

insert into public.employees (id, organization_id, profile_id, first_name, last_name, email, created_at)
select setup.employee_id, organization.id, profile.id, setup.first_name, setup.last_name, setup.email, setup.created_at
from (values
  ('c1000000-0000-0000-0000-000000000001'::uuid, 'c0000000-0000-0000-0000-000000000003'::uuid, 'Employee', 'A', 'employee-a@gate2.example', now() - interval '3 minutes'),
  ('c1000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000004'::uuid, 'Employee', 'B', 'employee-b@gate2.example', now() - interval '2 minutes'),
  ('c1000000-0000-0000-0000-000000000003'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid, 'Manager', 'A', 'manager-a@gate2.example', now() - interval '1 minute')
) setup(employee_id, auth_user_id, first_name, last_name, email, created_at)
join public.profiles profile on profile.auth_user_id = setup.auth_user_id
cross join public.organizations organization
where organization.slug = 'gate2-company-a';

insert into public.employee_availability (
  id, organization_id, employee_id, day_of_week, available, start_time, end_time, effective_from
)
select 'c2000000-0000-0000-0000-000000000002', id,
  'c1000000-0000-0000-0000-000000000002', 1, true, '08:00', '16:00', '2026-08-01'
from public.organizations where slug = 'gate2-company-a';

set local role authenticated;
set local "request.jwt.claim.sub" = 'c0000000-0000-0000-0000-000000000003';
select ok(public.has_permission((select id from public.organizations where slug = 'gate2-company-a'), 'availability.manage_self'), 'Employee receives availability.manage_self');
select ok(not public.has_permission((select id from public.organizations where slug = 'gate2-company-a'), 'availability.view'), 'Employee does not receive broad availability.view');
select ok(not public.has_permission((select id from public.organizations where slug = 'gate2-company-a'), 'timeoff.approve'), 'Employee does not receive timeoff.approve');

set local "request.jwt.claim.sub" = 'c0000000-0000-0000-0000-000000000002';
select ok(public.has_permission((select id from public.organizations where slug = 'gate2-company-a'), 'timeoff.approve'), 'Manager receives timeoff.approve');
select ok(public.has_permission((select id from public.organizations where slug = 'gate2-company-a'), 'availability.view'), 'Manager receives availability.view');

set local "request.jwt.claim.sub" = 'c0000000-0000-0000-0000-000000000003';
select lives_ok(
  $$ select public.save_my_availability(
    (select id from public.organizations where slug = 'gate2-company-a'),
    1::smallint, true, '09:00', '17:00', '2026-08-01', null
  ) $$,
  'Employee A can save Employee A availability'
);
select is((select count(*)::integer from public.employee_availability), 1, 'Employee A reads only Employee A availability');
select is((select count(*)::integer from public.employee_availability where id = 'c2000000-0000-0000-0000-000000000002'), 0, 'Employee A cannot read Employee B availability');
select throws_ok(
  $$ select public.delete_my_availability('c2000000-0000-0000-0000-000000000002') $$,
  '42501', 'Availability record not found or not owned by the current employee', 'Employee A cannot delete Employee B availability'
);

set local "request.jwt.claim.sub" = 'd0000000-0000-0000-0000-000000000001';
select public.create_organization('Gate 2 Company B', 'gate2-company-b', 'America/Chicago');
reset role;
insert into public.employees (id, organization_id, first_name, last_name, email)
select 'd1000000-0000-0000-0000-000000000001', id, 'Company', 'B Employee', 'company-b-employee@gate2.example'
from public.organizations where slug = 'gate2-company-b';
insert into public.employee_availability (
  id, organization_id, employee_id, day_of_week, available, start_time, end_time, effective_from
)
select 'd2000000-0000-0000-0000-000000000001', id,
  'd1000000-0000-0000-0000-000000000001', 1, false, null, null, '2026-08-01'
from public.organizations where slug = 'gate2-company-b';
insert into public.time_off_requests (
  id, organization_id, employee_id, start_date, end_date, reason
)
select 'd3000000-0000-0000-0000-000000000001', id,
  'd1000000-0000-0000-0000-000000000001', '2026-08-24', '2026-08-25', 'Company B request'
from public.organizations where slug = 'gate2-company-b';

set local role authenticated;
set local "request.jwt.claim.sub" = 'c0000000-0000-0000-0000-000000000003';
select is((select count(*)::integer from public.employee_availability where id = 'd2000000-0000-0000-0000-000000000001'), 0, 'Company A employee cannot read Company B availability');
select throws_ok(
  $$ select public.delete_my_availability('d2000000-0000-0000-0000-000000000001') $$,
  '42501', 'Availability record not found or not owned by the current employee', 'Company A employee cannot modify Company B availability'
);

set local "request.jwt.claim.sub" = 'c0000000-0000-0000-0000-000000000002';
select is((select count(*)::integer from public.employee_availability), 2, 'Company A manager sees Company A availability only');

set local "request.jwt.claim.sub" = 'c0000000-0000-0000-0000-000000000003';
select lives_ok(
  $$ select public.create_my_time_off_request(
    (select id from public.organizations where slug = 'gate2-company-a'),
    '2026-08-24', '2026-08-25', 'Employee A request'
  ) $$,
  'Employee can create own time-off request'
);
select is((select status::text from public.time_off_requests where reason = 'Employee A request'), 'pending', 'New employee request is pending');
select is((select count(*)::integer from public.time_off_requests), 1, 'Employee can read own time-off request');

set local "request.jwt.claim.sub" = 'c0000000-0000-0000-0000-000000000004';
select public.create_my_time_off_request(
  (select id from public.organizations where slug = 'gate2-company-a'),
  '2026-08-26', '2026-08-26', 'Employee B request'
);

set local "request.jwt.claim.sub" = 'c0000000-0000-0000-0000-000000000003';
select is((select count(*)::integer from public.time_off_requests where reason = 'Employee B request'), 0, 'Employee cannot read another employee request');
select throws_ok(
  $$ select public.review_time_off_request(
    (select id from public.time_off_requests where reason = 'Employee A request'), 'approved', ''
  ) $$,
  '42501', 'Time-off approval permission required', 'Employee cannot approve own request'
);

set local "request.jwt.claim.sub" = 'c0000000-0000-0000-0000-000000000002';
select lives_ok(
  $$ select public.review_time_off_request(
    (select id from public.time_off_requests where reason = 'Employee A request'), 'approved', 'Coverage confirmed'
  ) $$,
  'Manager can approve within own organization'
);
select is((select status::text from public.time_off_requests where reason = 'Employee A request'), 'approved', 'Manager approval is persisted');

set local "request.jwt.claim.sub" = 'c0000000-0000-0000-0000-000000000003';
select is((select status::text from public.time_off_requests where reason = 'Employee A request'), 'approved', 'Employee sees approved status');
select throws_ok(
  $$ select public.cancel_my_time_off_request((select id from public.time_off_requests where reason = 'Employee A request')) $$,
  'P0001', 'Only pending time-off requests can be cancelled', 'Employee cannot cancel an approved request'
);
select public.create_my_time_off_request(
  (select id from public.organizations where slug = 'gate2-company-a'),
  '2026-09-01', '2026-09-01', 'Cancel me'
);
select lives_ok(
  $$ select public.cancel_my_time_off_request((select id from public.time_off_requests where reason = 'Cancel me')) $$,
  'Employee can cancel own pending request'
);
select is((select status::text from public.time_off_requests where reason = 'Cancel me'), 'cancelled', 'Cancellation is persisted');

set local "request.jwt.claim.sub" = 'c0000000-0000-0000-0000-000000000002';
select lives_ok(
  $$ select public.create_my_time_off_request(
    (select id from public.organizations where slug = 'gate2-company-a'),
    '2026-09-02', '2026-09-02', 'Manager own request'
  ) $$,
  'Linked manager can use employee self-service'
);
select throws_ok(
  $$ select public.review_time_off_request(
    (select id from public.time_off_requests where reason = 'Manager own request'), 'approved', ''
  ) $$,
  '42501', 'Employees cannot approve or deny their own time-off request', 'A manager cannot approve their own employee request'
);

set local "request.jwt.claim.sub" = 'c0000000-0000-0000-0000-000000000001';
select is((select count(*)::integer from public.time_off_requests where id = 'd3000000-0000-0000-0000-000000000001'), 0, 'Company A cannot read Company B requests');
select throws_ok(
  $$ update public.time_off_requests set reason = 'Compromised' where id = 'd3000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'Company A cannot directly update Company B requests'
);
select throws_ok(
  $$ delete from public.time_off_requests where id = 'd3000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'Company A cannot directly delete Company B requests'
);
select throws_ok(
  $$ select public.review_time_off_request('d3000000-0000-0000-0000-000000000001', 'approved', '') $$,
  '42501', 'Time-off approval permission required', 'Company A cannot approve Company B requests'
);
select throws_ok(
  $$ select public.cancel_my_time_off_request('d3000000-0000-0000-0000-000000000001') $$,
  '42501', 'Time-off request not found or not owned by the current employee', 'Company A cannot cancel Company B requests'
);
select throws_ok(
  $$ update public.employee_availability set available = true where id = 'd2000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'Company A cannot directly update Company B availability'
);
select throws_ok(
  $$ delete from public.employee_availability where id = 'd2000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'Company A cannot directly delete Company B availability'
);

set local "request.jwt.claim.sub" = 'c0000000-0000-0000-0000-000000000003';
select throws_ok(
  $$ select public.save_my_availability(
    (select id from public.organizations where slug = 'gate2-company-a'), 8::smallint, true,
    '09:00', '17:00', '2026-08-01', null
  ) $$,
  'P0001', 'Availability day must be between 1 and 7', 'Invalid availability weekday is rejected'
);
select throws_ok(
  $$ select public.save_my_availability(
    (select id from public.organizations where slug = 'gate2-company-a'), 2::smallint, true,
    '17:00', '09:00', '2026-08-01', null
  ) $$,
  'P0001', 'Available days require a valid start and end time', 'Reversed availability time is rejected'
);
select throws_ok(
  $$ select public.create_my_time_off_request(
    (select id from public.organizations where slug = 'gate2-company-a'),
    '2026-09-10', '2026-09-09', 'Invalid dates'
  ) $$,
  'P0001', 'Time-off end date must not precede its start', 'Reversed time-off dates are rejected'
);

set local "request.jwt.claim.sub" = 'c0000000-0000-0000-0000-000000000002';
select lives_ok(
  $$ select public.review_time_off_request(
    (select id from public.time_off_requests where reason = 'Employee B request'), 'denied', 'Staffing conflict'
  ) $$,
  'Manager can deny within own organization'
);
select is((select status::text from public.time_off_requests where reason = 'Employee B request'), 'denied', 'Manager denial is persisted');

select * from finish();
rollback;
