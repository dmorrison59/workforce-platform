begin;
select plan(65);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '6a000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'gate6-owner-a@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '6a000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'gate6-manager-a@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '6a000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'gate6-employee-a@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '6a000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'gate6-employee-b@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '6b000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'gate6-owner-b@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

set local role authenticated;
set local "request.jwt.claim.sub" = '6a000000-0000-0000-0000-000000000001';
select public.create_organization('Gate 6 Company A', 'gate6-company-a', 'America/New_York');
set local "request.jwt.claim.sub" = '6b000000-0000-0000-0000-000000000001';
select public.create_organization('Gate 6 Company B', 'gate6-company-b', 'America/Chicago');

reset role;
insert into public.organization_memberships (organization_id, profile_id, role_id, membership_role, status)
select organization.id, profile.id, role.id, setup.membership_role, 'active'
from (values
  ('6a000000-0000-0000-0000-000000000002'::uuid, 'Manager'::text, 'manager'::public.membership_role),
  ('6a000000-0000-0000-0000-000000000003'::uuid, 'Employee'::text, 'employee'::public.membership_role),
  ('6a000000-0000-0000-0000-000000000004'::uuid, 'Employee'::text, 'employee'::public.membership_role)
) setup(auth_user_id, role_name, membership_role)
join public.profiles profile on profile.auth_user_id = setup.auth_user_id
cross join public.organizations organization
join public.roles role on role.organization_id = organization.id and role.name = setup.role_name
where organization.slug = 'gate6-company-a';

insert into public.employees (id, organization_id, profile_id, first_name, last_name, email)
select setup.employee_id, organization.id, profile.id, setup.first_name, setup.last_name, setup.email
from (values
  ('6a100000-0000-0000-0000-000000000001'::uuid, '6a000000-0000-0000-0000-000000000003'::uuid, 'Avery', 'Field', 'avery@gate6.example'),
  ('6a100000-0000-0000-0000-000000000002'::uuid, '6a000000-0000-0000-0000-000000000004'::uuid, 'Blake', 'Direct', 'blake@gate6.example')
) setup(employee_id, auth_user_id, first_name, last_name, email)
join public.profiles profile on profile.auth_user_id = setup.auth_user_id
cross join public.organizations organization where organization.slug = 'gate6-company-a';
insert into public.employees (id, organization_id, first_name, last_name, email)
select '6b100000-0000-0000-0000-000000000001', id, 'Bailey', 'Foreign', 'bailey@gate6.example'
from public.organizations where slug = 'gate6-company-b';
insert into public.locations (id, organization_id, name, address, city, state, postal_code)
select '6a200000-0000-0000-0000-000000000001', id, 'Field Office A', '1 Main St', 'Sampleville', 'NY', '10001'
from public.organizations where slug = 'gate6-company-a';
insert into public.locations (id, organization_id, name, address, city, state, postal_code)
select '6b200000-0000-0000-0000-000000000001', id, 'Field Office B', '2 Other St', 'Elsewhere', 'IL', '60001'
from public.organizations where slug = 'gate6-company-b';

set local role authenticated;
set local "request.jwt.claim.sub" = '6a000000-0000-0000-0000-000000000001';
select ok(public.has_permission((select id from public.organizations where slug = 'gate6-company-a'), 'crew.view'), 'Owner receives crew.view');
select ok(public.has_permission((select id from public.organizations where slug = 'gate6-company-a'), 'crew.manage'), 'Owner receives crew.manage');
select ok(public.has_permission((select id from public.organizations where slug = 'gate6-company-a'), 'job.view'), 'Owner receives job.view');
select ok(public.has_permission((select id from public.organizations where slug = 'gate6-company-a'), 'job.manage'), 'Owner receives job.manage');
select ok(public.has_permission((select id from public.organizations where slug = 'gate6-company-a'), 'job.assign'), 'Owner receives job.assign');

set local "request.jwt.claim.sub" = '6a000000-0000-0000-0000-000000000002';
select ok(public.has_permission((select id from public.organizations where slug = 'gate6-company-a'), 'crew.view'), 'Manager receives crew.view');
select ok(public.has_permission((select id from public.organizations where slug = 'gate6-company-a'), 'crew.manage'), 'Manager receives crew.manage');
select ok(public.has_permission((select id from public.organizations where slug = 'gate6-company-a'), 'job.view'), 'Manager receives job.view');
select ok(public.has_permission((select id from public.organizations where slug = 'gate6-company-a'), 'job.manage'), 'Manager receives job.manage');
select ok(public.has_permission((select id from public.organizations where slug = 'gate6-company-a'), 'job.assign'), 'Manager receives job.assign');

set local "request.jwt.claim.sub" = '6a000000-0000-0000-0000-000000000003';
select ok(public.has_permission((select id from public.organizations where slug = 'gate6-company-a'), 'crew.view'), 'Employee receives constrained crew.view');
select ok(public.has_permission((select id from public.organizations where slug = 'gate6-company-a'), 'job.view'), 'Employee receives constrained job.view');
select ok(not public.has_permission((select id from public.organizations where slug = 'gate6-company-a'), 'crew.manage'), 'Employee lacks crew.manage');
select ok(not public.has_permission((select id from public.organizations where slug = 'gate6-company-a'), 'job.manage'), 'Employee lacks job.manage');
select ok(not public.has_permission((select id from public.organizations where slug = 'gate6-company-a'), 'job.assign'), 'Employee lacks job.assign');

set local "request.jwt.claim.sub" = '6a000000-0000-0000-0000-000000000002';
select isnt(public.field_create_crew(
  (select id from public.organizations where slug = 'gate6-company-a'), 'Alpha Crew', '6a100000-0000-0000-0000-000000000001'
), null, 'Manager creates own-organization crew');
select isnt(public.field_add_crew_member(
  (select id from public.crews where name = 'Alpha Crew'), '6a100000-0000-0000-0000-000000000001', '2026-08-01', null
), null, 'Manager adds valid effective-dated crew member');
select isnt(public.field_create_job(
  (select id from public.organizations where slug = 'gate6-company-a'), 'Acme', 'Crew Job',
  '6a200000-0000-0000-0000-000000000001', '10 Field Way', '2026-08-22 09:00', '2026-08-22 17:00', 'scheduled', 'Gate 6 crew work'
), null, 'Manager creates scheduled own-organization job');
select isnt(public.field_assign_job(
  (select id from public.jobs where job_name = 'Crew Job'), (select id from public.crews where name = 'Alpha Crew'), null
), null, 'Manager assigns active crew');
select throws_ok($$ select public.field_assign_job(
  (select id from public.jobs where job_name = 'Crew Job'), (select id from public.crews where name = 'Alpha Crew'), null
) $$, '23505', null, 'Duplicate crew assignment is rejected');

select is((select count(*)::integer from public.crews), 1, 'Manager reads own crew only');
select is((select count(*)::integer from public.crew_members), 1, 'Manager reads own crew membership only');
select is((select count(*)::integer from public.jobs), 1, 'Manager reads own job only');
select is((select count(*)::integer from public.job_assignments), 1, 'Manager reads own assignment only');

set local "request.jwt.claim.sub" = '6b000000-0000-0000-0000-000000000001';
select public.field_create_crew((select id from public.organizations where slug = 'gate6-company-b'), 'Foreign Crew', null);
select public.field_create_job(
  (select id from public.organizations where slug = 'gate6-company-b'), 'Other Customer', 'Foreign Job',
  '6b200000-0000-0000-0000-000000000001', '20 Foreign Way', '2026-08-22 09:00', '2026-08-22 17:00', 'scheduled', ''
);
select public.field_assign_job(
  (select id from public.jobs where job_name = 'Foreign Job'), (select id from public.crews where name = 'Foreign Crew'), null
);

set local "request.jwt.claim.sub" = '6a000000-0000-0000-0000-000000000002';
select is((select count(*)::integer from public.crews where name = 'Foreign Crew'), 0, 'Company A cannot read Company B crews');
select is((select count(*)::integer from public.crew_members where organization_id = (select id from public.organizations where slug = 'gate6-company-b')), 0, 'Company A cannot read Company B crew members');
select is((select count(*)::integer from public.jobs where job_name = 'Foreign Job'), 0, 'Company A cannot read Company B jobs');
select is((select count(*)::integer from public.job_assignments where organization_id = (select id from public.organizations where slug = 'gate6-company-b')), 0, 'Company A cannot read Company B assignments');
select throws_ok($$ select public.field_update_crew((select id from public.crews where name = 'Foreign Crew'), 'Changed', null, true) $$,
  '42501', null, 'Company A cannot update Company B crew');
select throws_ok($$ select public.field_add_crew_member((select id from public.crews where name = 'Alpha Crew'), '6b100000-0000-0000-0000-000000000001', '2026-08-01', null) $$,
  'P0001', null, 'Company A cannot add Company B employee to crew');
select throws_ok($$ select public.field_create_job(
  (select id from public.organizations where slug = 'gate6-company-a'), 'Bad', 'Foreign Location', '6b200000-0000-0000-0000-000000000001',
  'Bad address', '2026-08-22 09:00', '2026-08-22 17:00', 'scheduled', ''
) $$, '23503', null, 'Company A cannot use Company B location');
select throws_ok($$ select public.field_update_job(
  (select id from public.jobs where job_name = 'Foreign Job'), 'Bad', 'Changed', null, 'Bad', '2026-08-22 09:00', '2026-08-22 17:00', ''
) $$, '42501', null, 'Company A cannot update Company B job');
select throws_ok($$ select public.field_change_job_status((select id from public.jobs where job_name = 'Foreign Job'), 'cancelled') $$,
  '42501', null, 'Company A cannot cancel Company B job');
select throws_ok($$ select public.field_assign_job((select id from public.jobs where job_name = 'Crew Job'), null, '6b100000-0000-0000-0000-000000000001') $$,
  'P0001', null, 'Company A cannot assign Company B employee');
select throws_ok($$ select public.field_assign_job((select id from public.jobs where job_name = 'Crew Job'), (select id from public.crews where name = 'Foreign Crew'), null) $$,
  'P0001', null, 'Company A cannot assign Company B crew');
select throws_ok($$ insert into public.crews (organization_id, name) values ((select id from public.organizations where slug = 'gate6-company-a'), 'Bypass') $$,
  '42501', null, 'Direct crew writes cannot bypass the service');

set local "request.jwt.claim.sub" = '6a000000-0000-0000-0000-000000000003';
select is((select count(*)::integer from public.jobs), 1, 'Employee sees job assigned to active crew');
select is((select count(*)::integer from public.crews), 1, 'Employee sees their assigned crew');
select is((select count(*)::integer from public.job_assignments), 1, 'Employee sees only relevant crew assignment');

set local "request.jwt.claim.sub" = '6a000000-0000-0000-0000-000000000004';
select is((select count(*)::integer from public.jobs), 0, 'Unrelated employee cannot see crew job');

set local "request.jwt.claim.sub" = '6a000000-0000-0000-0000-000000000003';
select throws_ok($$ select public.field_create_crew((select id from public.organizations where slug = 'gate6-company-a'), 'Employee Crew', null) $$,
  '42501', null, 'Employee cannot manage crews');
select throws_ok($$ select public.field_update_job((select id from public.jobs where job_name = 'Crew Job'), 'Bad', 'Bad', null, 'Bad', '2026-08-22 09:00', '2026-08-22 17:00', '') $$,
  '42501', null, 'Employee cannot edit jobs');
select throws_ok($$ select public.field_assign_job((select id from public.jobs where job_name = 'Crew Job'), null, '6a100000-0000-0000-0000-000000000001') $$,
  '42501', null, 'Employee cannot assign themselves');
select throws_ok($$ update public.jobs set notes = 'Bypass' where job_name = 'Crew Job' $$,
  '42501', null, 'Employee cannot directly mutate jobs');

set local "request.jwt.claim.sub" = '6a000000-0000-0000-0000-000000000002';
select lives_ok($$ select public.field_end_crew_membership((select id from public.crew_members where employee_id = '6a100000-0000-0000-0000-000000000001'), '2026-08-21') $$,
  'Manager ends membership without deleting history');
set local "request.jwt.claim.sub" = '6a000000-0000-0000-0000-000000000003';
select is((select count(*)::integer from public.jobs), 0, 'Expired crew membership does not expose job');

set local "request.jwt.claim.sub" = '6a000000-0000-0000-0000-000000000002';
select isnt(public.field_assign_job((select id from public.jobs where job_name = 'Crew Job'), null, '6a100000-0000-0000-0000-000000000002'), null,
  'Manager directly assigns valid employee');
select throws_ok($$ select public.field_assign_job((select id from public.jobs where job_name = 'Crew Job'), null, '6a100000-0000-0000-0000-000000000002') $$,
  '23505', null, 'Duplicate employee assignment is rejected');
set local "request.jwt.claim.sub" = '6a000000-0000-0000-0000-000000000004';
select is((select count(*)::integer from public.jobs), 1, 'Directly assigned employee sees job');
select is((select count(*)::integer from public.job_assignments), 1, 'Directly assigned employee cannot read unrelated assignment rows');

set local "request.jwt.claim.sub" = '6a000000-0000-0000-0000-000000000002';
select isnt(public.field_create_job(
  (select id from public.organizations where slug = 'gate6-company-a'), 'Acme', 'Second Job', null, '11 Field Way',
  '2026-08-23 09:00', '2026-08-23 17:00', 'scheduled', ''
), null, 'Manager creates another valid job');
select lives_ok($$ select public.field_update_crew((select id from public.crews where name = 'Alpha Crew'), 'Alpha Crew', null, false) $$,
  'Manager deactivates crew');
select throws_ok($$ select public.field_assign_job((select id from public.jobs where job_name = 'Second Job'), (select id from public.crews where name = 'Alpha Crew'), null) $$,
  'P0001', null, 'Inactive crew assignment is rejected');
select lives_ok($$ select public.field_change_job_status((select id from public.jobs where job_name = 'Second Job'), 'cancelled') $$,
  'Manager cancels own job');
select throws_ok($$ select public.field_assign_job((select id from public.jobs where job_name = 'Second Job'), null, '6a100000-0000-0000-0000-000000000002') $$,
  'P0001', null, 'Cancelled job cannot receive assignments');
select lives_ok($$ select public.field_change_job_status((select id from public.jobs where job_name = 'Crew Job'), 'completed') $$,
  'Manager completes scheduled job');
select throws_ok($$ select public.field_update_job((select id from public.jobs where job_name = 'Crew Job'), 'Acme', 'Edited', null, '10 Field Way', '2026-08-22 09:00', '2026-08-22 17:00', '') $$,
  'P0001', null, 'Completed job is read-only');

reset role;
select ok((select enabled from public.organization_modules module join public.organizations organization on organization.id = module.organization_id where organization.slug = 'gate6-company-a' and module.module_key = 'crews'), 'Crews module is enabled');
select ok((select enabled from public.organization_modules module join public.organizations organization on organization.id = module.organization_id where organization.slug = 'gate6-company-a' and module.module_key = 'jobs'), 'Jobs module is enabled');
select is((select count(*)::integer from public.permissions where capability in ('crew.view', 'crew.manage', 'job.view', 'job.manage', 'job.assign')), 5, 'Exactly five Gate 6 capabilities are registered');

set local role authenticated;
set local "request.jwt.claim.sub" = '6a000000-0000-0000-0000-000000000002';
select throws_ok($$ select public.field_create_crew((select id from public.organizations where slug = 'gate6-company-b'), 'Cross Tenant', null) $$,
  '42501', null, 'Company A cannot create Company B crew');
select throws_ok($$ select public.field_create_job((select id from public.organizations where slug = 'gate6-company-b'), 'Bad', 'Cross Tenant', null, 'Bad', '2026-08-22 09:00', '2026-08-22 17:00', 'scheduled', '') $$,
  '42501', null, 'Company A cannot create Company B job');
select throws_ok($$ delete from public.crews where name = 'Foreign Crew' $$,
  '42501', null, 'Company A cannot delete Company B crew');
select throws_ok($$ delete from public.jobs where job_name = 'Foreign Job' $$,
  '42501', null, 'Company A cannot delete Company B job');
select throws_ok($$ select public.field_update_crew((select id from public.crews where name = 'Alpha Crew'), 'Alpha Crew', '6b100000-0000-0000-0000-000000000001', true) $$,
  'P0001', null, 'Crew leader must belong to the same organization');

select * from finish();
rollback;
