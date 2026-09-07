begin;
select plan(39);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', 'd1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'role-owner-a@example.test', null, now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Owner","last_name":"A"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'd1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'role-owner-a2@example.test', null, now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Second","last_name":"Owner"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'd1000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'role-manager-a@example.test', null, now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Manager","last_name":"A"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'd1000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'role-employee-a@example.test', null, now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Employee","last_name":"A"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'd1000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'role-inactive-a@example.test', null, now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Inactive","last_name":"A"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'd2000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'role-owner-b@example.test', null, now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Owner","last_name":"B"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

set local role authenticated;
set local "request.jwt.claim.sub" = 'd1000000-0000-0000-0000-000000000001';
select public.create_organization('Role Test A', 'role-management-test-a', 'America/New_York');

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'd2000000-0000-0000-0000-000000000001';
select public.create_organization('Role Test B', 'role-management-test-b', 'America/Chicago');

reset role;
insert into public.organization_memberships (id, organization_id, profile_id, role_id, membership_role, status)
select 'd1100000-0000-0000-0000-000000000002', organization.id, profile.id, role.id, 'owner', 'active'
from public.organizations organization
join public.profiles profile on profile.auth_user_id = 'd1000000-0000-0000-0000-000000000002'
join public.roles role on role.organization_id = organization.id and role.name = 'Owner' and role.is_system
where organization.slug = 'role-management-test-a';

insert into public.organization_memberships (id, organization_id, profile_id, role_id, membership_role, status)
select 'd1100000-0000-0000-0000-000000000003', organization.id, profile.id, role.id, 'manager', 'active'
from public.organizations organization
join public.profiles profile on profile.auth_user_id = 'd1000000-0000-0000-0000-000000000003'
join public.roles role on role.organization_id = organization.id and role.name = 'Manager' and role.is_system
where organization.slug = 'role-management-test-a';

insert into public.organization_memberships (id, organization_id, profile_id, role_id, membership_role, status)
select 'd1100000-0000-0000-0000-000000000004', organization.id, profile.id, role.id, 'employee', 'active'
from public.organizations organization
join public.profiles profile on profile.auth_user_id = 'd1000000-0000-0000-0000-000000000004'
join public.roles role on role.organization_id = organization.id and role.name = 'Employee' and role.is_system
where organization.slug = 'role-management-test-a';

insert into public.organization_memberships (id, organization_id, profile_id, role_id, membership_role, status)
select 'd1100000-0000-0000-0000-000000000005', organization.id, profile.id, role.id, 'employee', 'suspended'
from public.organizations organization
join public.profiles profile on profile.auth_user_id = 'd1000000-0000-0000-0000-000000000005'
join public.roles role on role.organization_id = organization.id and role.name = 'Employee' and role.is_system
where organization.slug = 'role-management-test-a';

insert into public.employees (id, organization_id, profile_id, first_name, last_name, email)
select 'd1200000-0000-0000-0000-000000000003', organization.id, profile.id, 'Manager', 'A', 'role-manager-a@example.test'
from public.organizations organization
join public.profiles profile on profile.auth_user_id = 'd1000000-0000-0000-0000-000000000003'
where organization.slug = 'role-management-test-a';

insert into public.employees (id, organization_id, profile_id, first_name, last_name, email)
select 'd1200000-0000-0000-0000-000000000004', organization.id, profile.id, 'Employee', 'A', 'role-employee-a@example.test'
from public.organizations organization
join public.profiles profile on profile.auth_user_id = 'd1000000-0000-0000-0000-000000000004'
where organization.slug = 'role-management-test-a';

set local role authenticated;
set local "request.jwt.claim.sub" = 'd1000000-0000-0000-0000-000000000001';
select ok(public.has_permission((select id from public.organizations where slug = 'role-management-test-a'), 'settings.manage'), 'Owner has the existing role-management capability');

set local "request.jwt.claim.sub" = 'd1000000-0000-0000-0000-000000000003';
select isnt(public.has_permission((select id from public.organizations where slug = 'role-management-test-a'), 'settings.manage'), true, 'Manager does not have settings.manage');
set local "request.jwt.claim.sub" = 'd1000000-0000-0000-0000-000000000004';
select isnt(public.has_permission((select id from public.organizations where slug = 'role-management-test-a'), 'settings.manage'), true, 'Employee does not have settings.manage');

set local "request.jwt.claim.sub" = 'd1000000-0000-0000-0000-000000000001';
select is(
  public.change_organization_membership_role((select id from public.organizations where slug = 'role-management-test-a'), 'd1100000-0000-0000-0000-000000000004', 'manager'),
  'Manager', 'Owner can promote Employee to Manager'
);
select is((select membership_role::text from public.organization_memberships where id = 'd1100000-0000-0000-0000-000000000004'), 'manager', 'Promotion updates the coarse membership role');
select is((select role.name from public.organization_memberships membership join public.roles role on role.id = membership.role_id where membership.id = 'd1100000-0000-0000-0000-000000000004'), 'Manager', 'Promotion uses the same-tenant built-in Manager role');

set local "request.jwt.claim.sub" = 'd1000000-0000-0000-0000-000000000004';
select ok(public.has_permission((select id from public.organizations where slug = 'role-management-test-a'), 'schedule.manage'), 'Promoted Manager gains existing Manager capability');
select ok(public.has_permission((select id from public.organizations where slug = 'role-management-test-a'), 'timeoff.request'), 'Promoted Manager retains self-service capability');

set local "request.jwt.claim.sub" = 'd1000000-0000-0000-0000-000000000001';
select is(public.change_organization_membership_role((select id from public.organizations where slug = 'role-management-test-a'), 'd1100000-0000-0000-0000-000000000004', 'employee'), 'Employee', 'Owner can return Manager to Employee');
set local "request.jwt.claim.sub" = 'd1000000-0000-0000-0000-000000000004';
select isnt(public.has_permission((select id from public.organizations where slug = 'role-management-test-a'), 'schedule.manage'), true, 'Demoted Employee loses Manager capability');
select ok(public.has_permission((select id from public.organizations where slug = 'role-management-test-a'), 'timeoff.request'), 'Demoted Employee keeps employee self-service capability');

set local "request.jwt.claim.sub" = 'd1000000-0000-0000-0000-000000000003';
select throws_ok(
  $$ select public.change_organization_membership_role((select id from public.organizations where slug = 'role-management-test-a'), 'd1100000-0000-0000-0000-000000000004', 'manager') $$,
  '42501', 'Owner role-management permission required', 'Manager cannot change roles through the RPC'
);
set local "request.jwt.claim.sub" = 'd1000000-0000-0000-0000-000000000004';
select throws_ok(
  $$ select public.change_organization_membership_role((select id from public.organizations where slug = 'role-management-test-a'), 'd1100000-0000-0000-0000-000000000003', 'employee') $$,
  '42501', 'Owner role-management permission required', 'Employee cannot change roles through the RPC'
);

set local "request.jwt.claim.sub" = 'd1000000-0000-0000-0000-000000000001';
select is(public.change_organization_membership_role((select id from public.organizations where slug = 'role-management-test-a'), 'd1100000-0000-0000-0000-000000000004', 'owner'), 'Owner', 'Owner can promote an Employee to Owner');
select is((select membership_role::text from public.organization_memberships where id = 'd1100000-0000-0000-0000-000000000004'), 'owner', 'Owner promotion stores Owner membership role');
select is(public.change_organization_membership_role((select id from public.organizations where slug = 'role-management-test-a'), 'd1100000-0000-0000-0000-000000000004', 'manager'), 'Manager', 'An Owner may be demoted when other active Owners remain');
select is(public.change_organization_membership_role((select id from public.organizations where slug = 'role-management-test-a'), 'd1100000-0000-0000-0000-000000000003', 'owner'), 'Owner', 'Owner can promote a Manager to Owner');
select is(
  public.change_organization_membership_role(
    (select id from public.organizations where slug = 'role-management-test-a'),
    (select membership.id from public.organization_memberships membership join public.profiles profile on profile.id = membership.profile_id where profile.auth_user_id = 'd1000000-0000-0000-0000-000000000001'),
    'manager'
  ),
  'Manager', 'Owner can demote self when other active Owners remain'
);
select isnt(public.has_permission((select id from public.organizations where slug = 'role-management-test-a'), 'settings.manage'), true, 'Self-demotion removes Owner capability immediately');
select throws_ok(
  $$ select public.change_organization_membership_role((select id from public.organizations where slug = 'role-management-test-a'), 'd1100000-0000-0000-0000-000000000004', 'employee') $$,
  '42501', 'Owner role-management permission required', 'Self-demoted member cannot make another role change'
);

set local "request.jwt.claim.sub" = 'd1000000-0000-0000-0000-000000000002';
select is(
  public.change_organization_membership_role(
    (select id from public.organizations where slug = 'role-management-test-a'),
    (select membership.id from public.organization_memberships membership join public.profiles profile on profile.id = membership.profile_id where profile.auth_user_id = 'd1000000-0000-0000-0000-000000000001'),
    'owner'
  ),
  'Owner', 'Another Owner can restore the self-demoted member'
);
select throws_ok(
  $$ select public.change_organization_membership_role((select id from public.organizations where slug = 'role-management-test-a'), (select membership.id from public.organization_memberships membership join public.organizations organization on organization.id = membership.organization_id where organization.slug = 'role-management-test-b'), 'employee') $$,
  'P0002', 'Organization membership not found.', 'Known membership ID from another tenant cannot be targeted'
);
select throws_ok(
  $$ select public.change_organization_membership_role((select id from public.organizations where slug = 'role-management-test-a'), 'd1100000-0000-0000-0000-000000000004', 'supervisor') $$,
  '22023', 'Invalid organization role. Choose Employee, Manager, or Owner.', 'Unsupported role names are rejected'
);
select throws_ok(
  $$ select public.change_organization_membership_role((select id from public.organizations where slug = 'role-management-test-a'), 'd1100000-0000-0000-0000-000000000005', 'manager') $$,
  '55000', 'Only active organization memberships can change roles.', 'Inactive memberships cannot change roles'
);
select throws_ok(
  $$ select public.change_organization_membership_role((select id from public.organizations where slug = 'role-management-test-a'), 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'employee') $$,
  'P0002', 'Organization membership not found.', 'Missing memberships fail without creating data'
);

set local "request.jwt.claim.sub" = 'd2000000-0000-0000-0000-000000000001';
select throws_ok(
  $$ select public.change_organization_membership_role((select id from public.organizations where slug = 'role-management-test-b'), (select membership.id from public.organization_memberships membership join public.profiles profile on profile.id = membership.profile_id where profile.auth_user_id = 'd2000000-0000-0000-0000-000000000001'), 'manager') $$,
  '23514', 'This organization must always have at least one Owner. Promote another Owner before changing this role.', 'RPC cannot demote the final active Owner'
);
select throws_ok(
  $$ update public.organization_memberships set status = 'suspended' where profile_id = (select id from public.profiles where auth_user_id = 'd2000000-0000-0000-0000-000000000001') $$,
  '23514', 'This organization must always have at least one Owner. Promote another Owner before changing this role.', 'Direct update cannot suspend the final active Owner'
);
select throws_ok(
  $$ delete from public.organization_memberships where profile_id = (select id from public.profiles where auth_user_id = 'd2000000-0000-0000-0000-000000000001') $$,
  '23514', 'This organization must always have at least one Owner. Promote another Owner before changing this role.', 'Direct delete cannot remove the final active Owner'
);

set local "request.jwt.claim.sub" = 'd1000000-0000-0000-0000-000000000004';
select is_empty(
  $$ update public.organization_memberships set membership_role = 'employee' where id = 'd1100000-0000-0000-0000-000000000002' returning id $$,
  'Manager cannot use direct RLS update to change a role'
);

reset role;
select is((select count(*)::integer from auth.users where email like 'role-%@example.test'), 6, 'Role changes create no Auth users');
select is((select count(*)::integer from public.profiles where auth_user_id in ('d1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000003','d1000000-0000-0000-0000-000000000004','d1000000-0000-0000-0000-000000000005','d2000000-0000-0000-0000-000000000001')), 6, 'Role changes create no profiles');
select is((select count(*)::integer from public.employees where email in ('role-manager-a@example.test','role-employee-a@example.test')), 2, 'Role changes create no employees');
select is((select count(*)::integer from public.organization_memberships membership join public.organizations organization on organization.id = membership.organization_id where organization.slug in ('role-management-test-a','role-management-test-b')), 6, 'Role changes create no duplicate memberships');
select is((select count(*)::integer from public.employees where id in ('d1200000-0000-0000-0000-000000000003','d1200000-0000-0000-0000-000000000004') and employment_status = 'active'), 2, 'Linked employee records and employment state remain unchanged');
select ok((select count(*) > 0 from public.audit_events audit join public.profiles actor on actor.id = audit.actor_profile_id where audit.table_name = 'organization_memberships' and audit.record_id = 'd1100000-0000-0000-0000-000000000004' and audit.action = 'UPDATE' and actor.auth_user_id = 'd1000000-0000-0000-0000-000000000001'), 'Membership role changes record the authenticated actor through the existing audit-event pattern');
select is((select membership_role::text from public.organization_memberships membership join public.profiles profile on profile.id = membership.profile_id where profile.auth_user_id = 'd1000000-0000-0000-0000-000000000001'), 'owner', 'Restored Owner remains active after negative tests');
select is((select membership_role::text from public.organization_memberships membership join public.profiles profile on profile.id = membership.profile_id where profile.auth_user_id = 'd2000000-0000-0000-0000-000000000001'), 'owner', 'Final Owner remains intact after blocked operations');
select ok(has_function_privilege('authenticated', 'public.change_organization_membership_role(uuid,uuid,text)', 'EXECUTE'), 'Authenticated sessions may call the protected RPC');
select isnt(has_function_privilege('anon', 'public.change_organization_membership_role(uuid,uuid,text)', 'EXECUTE'), true, 'Anonymous sessions cannot call the role-change RPC');

select * from finish();
rollback;
