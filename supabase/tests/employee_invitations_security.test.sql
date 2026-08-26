begin;
select plan(12);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'manager-a@tenant-test.example', null, now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Manager","last_name":"A"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'manager-b@tenant-test.example', null, now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Manager","last_name":"B"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'invitee-a@tenant-test.example', null, now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Invitee","last_name":"A"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

set local role authenticated;
set local "request.jwt.claim.sub" = 'c0000000-0000-0000-0000-000000000001';
select public.create_organization('Invite Company A', 'invite-test-company-a', 'America/New_York');
select public.create_employee(
  target_organization_id => (select id from public.organizations where slug = 'invite-test-company-a'),
  employee_first_name => 'Invitee',
  employee_last_name => 'A',
  employee_email => 'invitee-a@tenant-test.example'
);

-- Remember Company A's id while Manager A can still read it.
create temporary table invite_test_ids as
select (select id::text from public.organizations where slug = 'invite-test-company-a') as org_a_id;

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'c0000000-0000-0000-0000-000000000002';
select public.create_organization('Invite Company B', 'invite-test-company-b', 'America/Chicago');
insert into public.employees (id, organization_id, first_name, last_name, email)
select 'd3000000-0000-0000-0000-000000000001', id, 'Worker', 'B', 'worker-b@tenant-test.example'
from public.organizations where slug = 'invite-test-company-b';

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'c0000000-0000-0000-0000-000000000001';
insert into public.employee_invitations (organization_id, employee_id, email, last_sent_at)
select organization_id, id, email, now()
from public.employees
where email = 'invitee-a@tenant-test.example';
select is(
  (select count(*)::integer from public.employee_invitations), 1,
  'Manager A can create a pending invitation for their own employee'
);
select is(
  (select count(*)::integer from public.employee_invitations
   where organization_id = (select id from public.organizations where slug = 'invite-test-company-b')),
  0, 'Manager A cannot read Company B invitations'
);
select throws_ok(
  $$ insert into public.employee_invitations (organization_id, employee_id, email)
     values (
       (select id from public.organizations where slug = 'invite-test-company-b'),
       'd3000000-0000-0000-0000-000000000001',
       'worker-b@tenant-test.example'
     ) $$,
  '42501', null, 'Manager A cannot insert an invitation into Company B'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'c0000000-0000-0000-0000-000000000002';
select is(
  (select count(*)::integer from public.employee_invitations), 0,
  'Manager B cannot read Company A invitations'
);
select is_empty(
  $$ update public.employee_invitations set revoked_at = now() returning id $$,
  'Manager B cannot revoke a Company A invitation'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'c0000000-0000-0000-0000-000000000003';
select is(
  (select count(*)::integer from public.employee_invitations), 0,
  'Invited employee cannot read invitation rows'
);
select is(
  public.accept_employee_invitation()::text,
  (select org_a_id from invite_test_ids),
  'Invited employee accepts and links to Company A'
);
select is(
  (select membership_role::text from public.organization_memberships
   where profile_id = public.current_profile_id()),
  'employee', 'Accepted employee receives the employee membership role'
);
select is(
  (select app_access_status::text from public.employees where email = 'invitee-a@tenant-test.example'),
  'active', 'Employee app access status becomes active'
);
select is(
  (select count(*)::integer from public.employee_invitations where accepted_at is null), 0,
  'Invitation is marked accepted'
);
select is(
  public.accept_employee_invitation(), null::uuid, 'Second acceptance call is a no-op'
);
select is(
  (select count(*)::integer from public.organization_memberships
   where profile_id = public.current_profile_id()),
  1, 'No duplicate membership is created'
);

select * from finish();
rollback;