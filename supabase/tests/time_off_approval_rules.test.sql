begin;
select plan(38);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', 'e1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'sole-owner@timeoff-rules.test', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'inactive-owner@timeoff-rules.test', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e2000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner-a@timeoff-rules.test', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e2000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'owner-b@timeoff-rules.test', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e2000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'manager@timeoff-rules.test', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e2000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'employee@timeoff-rules.test', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e3000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'foreign-owner@timeoff-rules.test', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

set local role authenticated;
set local "request.jwt.claim.sub" = 'e1000000-0000-0000-0000-000000000001';
select public.create_organization('Sole Owner Time Off', 'timeoff-rules-sole', 'America/New_York');
set local "request.jwt.claim.sub" = 'e2000000-0000-0000-0000-000000000001';
select public.create_organization('Multi Owner Time Off', 'timeoff-rules-multi', 'America/New_York');
set local "request.jwt.claim.sub" = 'e3000000-0000-0000-0000-000000000001';
select public.create_organization('Foreign Time Off', 'timeoff-rules-foreign', 'America/Chicago');

reset role;
insert into public.organization_memberships (organization_id, profile_id, role_id, membership_role, status)
select organization.id, profile.id, role.id, 'owner', 'suspended'
from public.organizations organization
join public.profiles profile on profile.auth_user_id = 'e1000000-0000-0000-0000-000000000002'
join public.roles role on role.organization_id = organization.id and role.name = 'Owner' and role.is_system
where organization.slug = 'timeoff-rules-sole';

insert into public.organization_memberships (organization_id, profile_id, role_id, membership_role, status)
select organization.id, profile.id, role.id, setup.membership_role, 'active'
from (values
  ('e2000000-0000-0000-0000-000000000002'::uuid, 'Owner'::text, 'owner'::public.membership_role),
  ('e2000000-0000-0000-0000-000000000003'::uuid, 'Manager'::text, 'manager'::public.membership_role),
  ('e2000000-0000-0000-0000-000000000004'::uuid, 'Employee'::text, 'employee'::public.membership_role)
) setup(auth_user_id, role_name, membership_role)
join public.profiles profile on profile.auth_user_id = setup.auth_user_id
cross join public.organizations organization
join public.roles role on role.organization_id = organization.id and role.name = setup.role_name and role.is_system
where organization.slug = 'timeoff-rules-multi';

insert into public.employees (id, organization_id, profile_id, first_name, last_name, email)
select setup.employee_id, organization.id, profile.id, setup.first_name, setup.last_name, setup.email
from (values
  ('e1100000-0000-0000-0000-000000000001'::uuid, 'e1000000-0000-0000-0000-000000000001'::uuid, 'timeoff-rules-sole', 'Sole', 'Owner', 'sole-owner@timeoff-rules.test'),
  ('e2100000-0000-0000-0000-000000000001'::uuid, 'e2000000-0000-0000-0000-000000000001'::uuid, 'timeoff-rules-multi', 'Owner', 'A', 'owner-a@timeoff-rules.test'),
  ('e2100000-0000-0000-0000-000000000002'::uuid, 'e2000000-0000-0000-0000-000000000002'::uuid, 'timeoff-rules-multi', 'Owner', 'B', 'owner-b@timeoff-rules.test'),
  ('e2100000-0000-0000-0000-000000000003'::uuid, 'e2000000-0000-0000-0000-000000000003'::uuid, 'timeoff-rules-multi', 'Manager', 'Member', 'manager@timeoff-rules.test'),
  ('e2100000-0000-0000-0000-000000000004'::uuid, 'e2000000-0000-0000-0000-000000000004'::uuid, 'timeoff-rules-multi', 'Employee', 'Member', 'employee@timeoff-rules.test'),
  ('e3100000-0000-0000-0000-000000000001'::uuid, 'e3000000-0000-0000-0000-000000000001'::uuid, 'timeoff-rules-foreign', 'Foreign', 'Owner', 'foreign-owner@timeoff-rules.test')
) setup(employee_id, auth_user_id, organization_slug, first_name, last_name, email)
join public.organizations organization on organization.slug = setup.organization_slug
join public.profiles profile on profile.auth_user_id = setup.auth_user_id;

select is(
  (select count(*)::integer from public.organization_memberships membership
    join public.roles role on role.id = membership.role_id and role.organization_id = membership.organization_id
   where membership.organization_id = (select id from public.organizations where slug = 'timeoff-rules-sole')
     and membership.status = 'active' and membership.membership_role = 'owner'
     and role.is_system and role.name = 'Owner'),
  1, 'Inactive Owner membership is ignored by the active Owner count'
);

set local role authenticated;
set local "request.jwt.claim.sub" = 'e1000000-0000-0000-0000-000000000001';
select lives_ok(
  $$ select public.create_my_time_off_request(
    (select id from public.organizations where slug = 'timeoff-rules-sole'),
    '2026-10-01', '2026-10-02', 'Sole Owner system approval'
  ) $$,
  'Sole active Owner can create a request'
);

reset role;
select is((select status::text from public.time_off_requests where reason = 'Sole Owner system approval'), 'approved', 'Sole Owner request is approved immediately');
select is((select reviewed_by from public.time_off_requests where reason = 'Sole Owner system approval'), null::uuid, 'System approval does not fabricate a reviewer');
select ok((select reviewed_at is not null from public.time_off_requests where reason = 'Sole Owner system approval'), 'System approval records its decision time');
select is((select manager_note from public.time_off_requests where reason = 'Sole Owner system approval'), '', 'System approval does not fabricate a manager note');
select is((select count(*)::integer from public.time_off_requests where reason = 'Sole Owner system approval' and status = 'approved' and start_date <= '2026-10-01' and end_date >= '2026-10-01'), 1, 'Scheduling approved-time-off query sees the system-approved request');
select ok((select count(*) > 0 from public.audit_events audit join public.profiles actor on actor.id = audit.actor_profile_id where audit.table_name = 'time_off_requests' and audit.record_id = (select id from public.time_off_requests where reason = 'Sole Owner system approval') and audit.action = 'INSERT' and actor.auth_user_id = 'e1000000-0000-0000-0000-000000000001'), 'Creation audit identifies the authenticated requester as actor');

set local role authenticated;
set local "request.jwt.claim.sub" = 'e1000000-0000-0000-0000-000000000001';
select throws_ok(
  $$ select public.cancel_my_time_off_request((select id from public.time_off_requests where reason = 'Sole Owner system approval')) $$,
  'P0001', 'Only pending time-off requests can be cancelled', 'System-approved request cannot be cancelled as pending'
);

set local "request.jwt.claim.sub" = 'e2000000-0000-0000-0000-000000000001';
select lives_ok(
  $$ select public.create_my_time_off_request(
    (select id from public.organizations where slug = 'timeoff-rules-multi'),
    '2026-10-03', '2026-10-03', 'Owner A pending for Owner B'
  ) $$,
  'Owner can create a request when another active Owner exists'
);
select is((select status::text from public.time_off_requests where reason = 'Owner A pending for Owner B'), 'pending', 'Multi-owner request remains pending');
select ok((select reviewed_by is null and reviewed_at is null from public.time_off_requests where reason = 'Owner A pending for Owner B'), 'Pending request keeps empty review metadata');
select throws_ok(
  $$ select public.review_time_off_request((select id from public.time_off_requests where reason = 'Owner A pending for Owner B'), 'approved', '') $$,
  '42501', 'Employees cannot approve or deny their own time-off request', 'Owner cannot approve own pending request'
);
select throws_ok(
  $$ select public.review_time_off_request((select id from public.time_off_requests where reason = 'Owner A pending for Owner B'), 'denied', '') $$,
  '42501', 'Employees cannot approve or deny their own time-off request', 'Owner cannot deny own pending request'
);

set local "request.jwt.claim.sub" = 'e2000000-0000-0000-0000-000000000002';
select lives_ok(
  $$ select public.review_time_off_request((select id from public.time_off_requests where reason = 'Owner A pending for Owner B'), 'approved', 'Owner B reviewed') $$,
  'Another Owner can approve the requester'
);
select is((select status::text from public.time_off_requests where reason = 'Owner A pending for Owner B'), 'approved', 'Another Owner approval persists');
select is((select actor.auth_user_id from public.time_off_requests request join public.profiles actor on actor.id = request.reviewed_by where request.reason = 'Owner A pending for Owner B'), 'e2000000-0000-0000-0000-000000000002'::uuid, 'Manual Owner approval records the real reviewer');
select ok((select reviewed_at is not null from public.time_off_requests where reason = 'Owner A pending for Owner B'), 'Manual Owner approval records review time');
select ok((select count(*) > 0 from public.audit_events audit join public.profiles actor on actor.id = audit.actor_profile_id where audit.table_name = 'time_off_requests' and audit.record_id = (select id from public.time_off_requests where reason = 'Owner A pending for Owner B') and audit.action = 'UPDATE' and actor.auth_user_id = 'e2000000-0000-0000-0000-000000000002'), 'Manual review audit identifies the authenticated reviewer as actor');

set local "request.jwt.claim.sub" = 'e2000000-0000-0000-0000-000000000001';
select public.create_my_time_off_request(
  (select id from public.organizations where slug = 'timeoff-rules-multi'),
  '2026-10-04', '2026-10-04', 'Owner A pending for Manager'
);
select is((select status::text from public.time_off_requests where reason = 'Owner A pending for Manager'), 'pending', 'A second multi-owner request is also pending');

set local "request.jwt.claim.sub" = 'e2000000-0000-0000-0000-000000000003';
select lives_ok(
  $$ select public.review_time_off_request((select id from public.time_off_requests where reason = 'Owner A pending for Manager'), 'approved', 'Manager reviewed') $$,
  'Authorized Manager can approve another member request'
);
select is((select actor.auth_user_id from public.time_off_requests request join public.profiles actor on actor.id = request.reviewed_by where request.reason = 'Owner A pending for Manager'), 'e2000000-0000-0000-0000-000000000003'::uuid, 'Manager approval records the real reviewer');

select public.create_my_time_off_request(
  (select id from public.organizations where slug = 'timeoff-rules-multi'),
  '2026-10-05', '2026-10-05', 'Manager own pending request'
);
select is((select status::text from public.time_off_requests where reason = 'Manager own pending request'), 'pending', 'Manager request never receives sole-Owner auto-approval');
select throws_ok(
  $$ select public.review_time_off_request((select id from public.time_off_requests where reason = 'Manager own pending request'), 'approved', '') $$,
  '42501', 'Employees cannot approve or deny their own time-off request', 'Manager cannot approve own request'
);

set local "request.jwt.claim.sub" = 'e2000000-0000-0000-0000-000000000002';
select lives_ok(
  $$ select public.review_time_off_request((select id from public.time_off_requests where reason = 'Manager own pending request'), 'denied', 'Coverage unavailable') $$,
  'Another authorized Owner can deny a Manager request'
);
select ok((select reviewed_by is not null and reviewed_at is not null from public.time_off_requests where reason = 'Manager own pending request' and status = 'denied'), 'Manual denial retains complete reviewer metadata');

set local "request.jwt.claim.sub" = 'e2000000-0000-0000-0000-000000000004';
select public.create_my_time_off_request(
  (select id from public.organizations where slug = 'timeoff-rules-multi'),
  '2026-10-06', '2026-10-06', 'Employee pending request'
);
select is((select status::text from public.time_off_requests where reason = 'Employee pending request'), 'pending', 'Non-Owner employee request never auto-approves');
select throws_ok(
  $$ select public.review_time_off_request((select id from public.time_off_requests where reason = 'Employee pending request'), 'approved', '') $$,
  '42501', 'Time-off approval permission required', 'Employee cannot approve own request'
);
select lives_ok(
  $$ select public.cancel_my_time_off_request((select id from public.time_off_requests where reason = 'Employee pending request')) $$,
  'Employee may still cancel own pending request'
);

reset role;
select ok((select status = 'cancelled' and reviewed_by is null and reviewed_at is null from public.time_off_requests where reason = 'Employee pending request'), 'Cancelled request keeps the existing empty review metadata');

insert into public.time_off_requests (id, organization_id, employee_id, start_date, end_date, reason)
select 'e3200000-0000-0000-0000-000000000001', organization.id, 'e3100000-0000-0000-0000-000000000001', '2026-10-07', '2026-10-07', 'Foreign pending request'
from public.organizations organization where organization.slug = 'timeoff-rules-foreign';

set local role authenticated;
set local "request.jwt.claim.sub" = 'e2000000-0000-0000-0000-000000000002';
select throws_ok(
  $$ select public.review_time_off_request('e3200000-0000-0000-0000-000000000001', 'approved', '') $$,
  '42501', 'Time-off approval permission required', 'Cross-organization review remains blocked'
);

reset role;
select throws_ok(
  $$ insert into public.time_off_requests (organization_id, employee_id, start_date, end_date, reason, status, reviewed_at)
     select id, 'e2100000-0000-0000-0000-000000000004', '2026-11-01', '2026-11-01', 'Invalid pending metadata', 'pending', now()
       from public.organizations where slug = 'timeoff-rules-multi' $$,
  '23514', null, 'Pending state still rejects review metadata'
);
select throws_ok(
  $$ insert into public.time_off_requests (organization_id, employee_id, start_date, end_date, reason, status, reviewed_at)
     select id, 'e2100000-0000-0000-0000-000000000004', '2026-11-02', '2026-11-02', 'Invalid cancelled metadata', 'cancelled', now()
       from public.organizations where slug = 'timeoff-rules-multi' $$,
  '23514', null, 'Cancelled state still rejects review metadata'
);
select throws_ok(
  $$ insert into public.time_off_requests (organization_id, employee_id, start_date, end_date, reason, status, reviewed_at)
     select id, 'e2100000-0000-0000-0000-000000000004', '2026-11-03', '2026-11-03', 'Invalid denied metadata', 'denied', now()
       from public.organizations where slug = 'timeoff-rules-multi' $$,
  '23514', null, 'Denied state still requires a real reviewer'
);
select throws_ok(
  $$ insert into public.time_off_requests (organization_id, employee_id, start_date, end_date, reason, status)
     select id, 'e2100000-0000-0000-0000-000000000004', '2026-11-04', '2026-11-04', 'Invalid system approval metadata', 'approved'
       from public.organizations where slug = 'timeoff-rules-multi' $$,
  '23514', null, 'Approved state still requires a decision timestamp'
);
select lives_ok(
  $$ insert into public.time_off_requests (organization_id, employee_id, start_date, end_date, reason, status, reviewed_by, reviewed_at)
     select organization.id, 'e2100000-0000-0000-0000-000000000004', '2026-11-05', '2026-11-05', 'Valid manual approval metadata', 'approved', profile.id, now()
       from public.organizations organization
       join public.profiles profile on profile.auth_user_id = 'e2000000-0000-0000-0000-000000000002'
      where organization.slug = 'timeoff-rules-multi' $$,
  'Manual approved state with a real reviewer remains valid'
);
select lives_ok(
  $$ insert into public.time_off_requests (organization_id, employee_id, start_date, end_date, reason, status, reviewed_by, reviewed_at)
     select organization.id, 'e2100000-0000-0000-0000-000000000004', '2026-11-06', '2026-11-06', 'Valid manual denial metadata', 'denied', profile.id, now()
       from public.organizations organization
       join public.profiles profile on profile.auth_user_id = 'e2000000-0000-0000-0000-000000000002'
      where organization.slug = 'timeoff-rules-multi' $$,
  'Manual denied state with a real reviewer remains valid'
);
select lives_ok(
  $$ insert into public.time_off_requests (organization_id, employee_id, start_date, end_date, reason, status, reviewed_by, reviewed_at)
     select id, 'e2100000-0000-0000-0000-000000000004', '2026-11-07', '2026-11-07', 'Valid system approval metadata', 'approved', null, now()
       from public.organizations where slug = 'timeoff-rules-multi' $$,
  'Only the new approved/null-reviewer/timestamp state is additionally valid'
);

select * from finish();
rollback;
