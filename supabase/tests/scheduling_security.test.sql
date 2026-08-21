begin;
select plan(38);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', 'a4000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'schedule-owner-a@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a4000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'schedule-employee-a@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b4000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'schedule-owner-b@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

set local role authenticated;
set local "request.jwt.claim.sub" = 'a4000000-0000-0000-0000-000000000001';
select public.create_organization('Schedule Company A', 'schedule-company-a', 'America/New_York');

select ok(public.has_permission((select id from public.organizations where slug = 'schedule-company-a'), 'schedule.view'), 'Owner receives schedule.view');
select ok(exists (
  select 1 from public.roles role join public.role_permissions grant_row on grant_row.role_id = role.id
  join public.permissions permission on permission.id = grant_row.permission_id
  where role.organization_id = (select id from public.organizations where slug = 'schedule-company-a')
    and role.name = 'Manager' and permission.capability = 'schedule.manage'
), 'Manager receives schedule.manage');
select ok(exists (
  select 1 from public.roles role join public.role_permissions grant_row on grant_row.role_id = role.id
  join public.permissions permission on permission.id = grant_row.permission_id
  where role.organization_id = (select id from public.organizations where slug = 'schedule-company-a')
    and role.name = 'Manager' and permission.capability = 'schedule.publish'
), 'Manager receives schedule.publish');
select ok(exists (
  select 1 from public.roles role join public.role_permissions grant_row on grant_row.role_id = role.id
  join public.permissions permission on permission.id = grant_row.permission_id
  where role.organization_id = (select id from public.organizations where slug = 'schedule-company-a')
    and role.name = 'Employee' and permission.capability = 'schedule.view'
), 'Employee receives schedule.view');
select ok(not exists (
  select 1 from public.roles role join public.role_permissions grant_row on grant_row.role_id = role.id
  join public.permissions permission on permission.id = grant_row.permission_id
  where role.organization_id = (select id from public.organizations where slug = 'schedule-company-a')
    and role.name = 'Employee' and permission.capability = 'schedule.manage'
), 'Employee does not receive schedule.manage');

insert into public.locations (id, organization_id, name, address, city, state, postal_code)
select 'a4100000-0000-0000-0000-000000000001', id, 'Company A Main', '1 A Street', 'New York', 'NY', '10001'
from public.organizations where slug = 'schedule-company-a';
insert into public.departments (id, organization_id, location_id, name)
select 'a4200000-0000-0000-0000-000000000001', id, 'a4100000-0000-0000-0000-000000000001', 'Operations'
from public.organizations where slug = 'schedule-company-a';

-- Account linking is setup data for this RLS test. It runs as the database owner
-- because an organization owner cannot read a profile before that profile joins.
reset role;
insert into public.organization_memberships (organization_id, profile_id, role_id, membership_role, status)
select organization.id, profile.id, role.id, 'employee', 'active'
from public.organizations organization
join public.roles role on role.organization_id = organization.id and role.name = 'Employee'
cross join public.profiles profile
where organization.slug = 'schedule-company-a'
  and profile.auth_user_id = 'a4000000-0000-0000-0000-000000000002';
insert into public.employees (id, organization_id, profile_id, first_name, last_name, email)
select 'a4300000-0000-0000-0000-000000000001', organization.id, profile.id, 'Assigned', 'Employee', 'assigned-a@test.example'
from public.organizations organization
cross join public.profiles profile
where organization.slug = 'schedule-company-a'
  and profile.auth_user_id = 'a4000000-0000-0000-0000-000000000002';
insert into public.employees (id, organization_id, first_name, last_name, email)
select 'a4300000-0000-0000-0000-000000000002', id, 'Other', 'Employee', 'other-a@test.example'
from public.organizations where slug = 'schedule-company-a';

set local role authenticated;
set local "request.jwt.claim.sub" = 'a4000000-0000-0000-0000-000000000001';

select lives_ok(
  $$ select public.create_weekly_schedule(
    (select id from public.organizations where slug = 'schedule-company-a'),
    'a4100000-0000-0000-0000-000000000001', '2026-08-24'
  ) $$,
  'Manager operation creates a weekly schedule'
);
select is((select count(*)::integer from public.schedules where week_start = '2026-08-24'), 1, 'Weekly schedule was created');
select is((select status::text from public.schedules where week_start = '2026-08-24'), 'draft', 'New schedule is draft');

select lives_ok(
  $$ select public.create_schedule_shift(
    (select id from public.schedules where week_start = '2026-08-24'),
    'a4200000-0000-0000-0000-000000000001', null, null,
    '2026-08-24 09:00', '2026-08-24 17:00', 30, 'Primary shift'
  ) $$,
  'Manager operation creates an unassigned shift'
);
select lives_ok(
  $$ select public.assign_schedule_shift(
    (select id from public.shifts where notes = 'Primary shift'),
    'a4300000-0000-0000-0000-000000000001'
  ) $$,
  'Manager operation assigns an employee'
);
select is((select employee_id from public.shifts where notes = 'Primary shift'), 'a4300000-0000-0000-0000-000000000001'::uuid, 'Shift stores the assigned employee');
select lives_ok(
  $$ select public.update_schedule_shift(
    (select id from public.shifts where notes = 'Primary shift'),
    'a4200000-0000-0000-0000-000000000001', null,
    'a4300000-0000-0000-0000-000000000001',
    '2026-08-24 10:00', '2026-08-24 18:00', 45, 'Edited shift'
  ) $$,
  'Manager operation edits a shift'
);
select is((select notes from public.shifts where notes = 'Edited shift'), 'Edited shift', 'Shift edit was persisted');

select public.create_schedule_shift(
  (select id from public.schedules where week_start = '2026-08-24'),
  'a4200000-0000-0000-0000-000000000001', null,
  'a4300000-0000-0000-0000-000000000002',
  '2026-08-24 08:00', '2026-08-24 12:00', 15, 'Other employee shift'
);
select throws_ok(
  $$ select public.create_schedule_shift(
    (select id from public.schedules where week_start = '2026-08-24'),
    'a4200000-0000-0000-0000-000000000001', null,
    'a4300000-0000-0000-0000-000000000001',
    '2026-08-24 17:00', '2026-08-24 19:00', 0, 'Overlap'
  ) $$,
  'P0001', 'Employee already has an overlapping shift', 'Overlapping employee shifts are rejected'
);
select lives_ok(
  $$ select public.copy_schedule_shift(
    (select id from public.shifts where notes = 'Edited shift'), '2026-08-25'
  ) $$,
  'Manager operation copies a shift to another day'
);
select is((select count(*)::integer from public.shifts where employee_id = 'a4300000-0000-0000-0000-000000000001'), 2, 'Copied shift preserves its employee assignment');
select lives_ok(
  $$ select public.copy_schedule_week(
    (select id from public.schedules where week_start = '2026-08-24'), '2026-08-31'
  ) $$,
  'Manager operation copies a week'
);
select is((select count(*)::integer from public.schedules where week_start = '2026-08-31' and status = 'draft'), 1, 'Copied week remains draft');

select public.create_schedule_shift(
  (select id from public.schedules where week_start = '2026-08-24'),
  'a4200000-0000-0000-0000-000000000001', null, null,
  '2026-08-26 13:00', '2026-08-26 14:00', 0, 'Temporary shift'
);
select lives_ok(
  $$ select public.delete_schedule_shift((select id from public.shifts where notes = 'Temporary shift')) $$,
  'Manager operation deletes a shift'
);
select is((select count(*)::integer from public.shifts where notes = 'Temporary shift'), 0, 'Deleted shift is gone');

set local "request.jwt.claim.sub" = 'a4000000-0000-0000-0000-000000000002';
select is((select count(*)::integer from public.schedules), 0, 'Employee cannot see draft schedules');
select is((select count(*)::integer from public.shifts), 0, 'Employee cannot see draft shifts');

set local "request.jwt.claim.sub" = 'a4000000-0000-0000-0000-000000000001';
select lives_ok(
  $$ select public.publish_weekly_schedule((select id from public.schedules where week_start = '2026-08-24')) $$,
  'Manager operation publishes the schedule'
);
select is((select status::text from public.schedules where week_start = '2026-08-24'), 'published', 'Schedule is published');
select is((select count(*)::integer from public.shifts where schedule_id = (select id from public.schedules where week_start = '2026-08-24') and status = 'published'), 3, 'Publishing marks every active shift published');

set local "request.jwt.claim.sub" = 'a4000000-0000-0000-0000-000000000002';
select is((select count(*)::integer from public.schedules), 1, 'Employee sees the published schedule containing their shift');
select is((select count(*)::integer from public.shifts), 2, 'Employee sees only their own two published shifts');
select is((select count(*)::integer from public.shifts where notes = 'Other employee shift'), 0, 'Employee cannot see another employee shift');
select throws_ok(
  $$ select public.publish_weekly_schedule((select id from public.schedules limit 1)) $$,
  '42501', 'Schedule publishing permission required', 'Employee cannot publish a schedule'
);

set local "request.jwt.claim.sub" = 'b4000000-0000-0000-0000-000000000001';
select public.create_organization('Schedule Company B', 'schedule-company-b', 'America/Chicago');
insert into public.locations (id, organization_id, name, address, city, state, postal_code)
select 'b4100000-0000-0000-0000-000000000001', id, 'Company B Main', '2 B Street', 'Chicago', 'IL', '60601'
from public.organizations where slug = 'schedule-company-b';
insert into public.departments (id, organization_id, location_id, name)
select 'b4200000-0000-0000-0000-000000000001', id, 'b4100000-0000-0000-0000-000000000001', 'Company B Ops'
from public.organizations where slug = 'schedule-company-b';
insert into public.employees (id, organization_id, first_name, last_name, email)
select 'b4300000-0000-0000-0000-000000000001', id, 'Company', 'B Employee', 'employee-b@test.example'
from public.organizations where slug = 'schedule-company-b';
select public.create_weekly_schedule(
  (select id from public.organizations where slug = 'schedule-company-b'),
  'b4100000-0000-0000-0000-000000000001', '2026-08-24'
);
select public.create_schedule_shift(
  (select id from public.schedules where organization_id = (select id from public.organizations where slug = 'schedule-company-b')),
  'b4200000-0000-0000-0000-000000000001', null,
  'b4300000-0000-0000-0000-000000000001',
  '2026-08-24 09:00', '2026-08-24 17:00', 30, 'Company B shift'
);

set local "request.jwt.claim.sub" = 'a4000000-0000-0000-0000-000000000001';
select is((select count(*)::integer from public.schedules where location_id = 'b4100000-0000-0000-0000-000000000001'), 0, 'Company A cannot read Company B schedules by known UUID');
select is((select count(*)::integer from public.shifts where employee_id = 'b4300000-0000-0000-0000-000000000001'), 0, 'Company A cannot read Company B shifts by known UUID');
select throws_ok(
  $$ update public.schedules set week_start = '2026-09-07' where location_id = 'b4100000-0000-0000-0000-000000000001' $$,
  '42501', null, 'Company A cannot directly update Company B schedules'
);
select throws_ok(
  $$ update public.shifts set notes = 'Compromised' where employee_id = 'b4300000-0000-0000-0000-000000000001' $$,
  '42501', null, 'Company A cannot directly update Company B shifts'
);
select throws_ok(
  $$ delete from public.schedules where location_id = 'b4100000-0000-0000-0000-000000000001' $$,
  '42501', null, 'Company A cannot directly delete Company B schedules'
);
select throws_ok(
  $$ delete from public.shifts where employee_id = 'b4300000-0000-0000-0000-000000000001' $$,
  '42501', null, 'Company A cannot directly delete Company B shifts'
);
select throws_ok(
  $$ select public.delete_schedule_shift((select id from public.shifts where notes = 'Company B shift')) $$,
  '42501', 'Schedule management permission required', 'Company A cannot delete Company B shifts through the service'
);

select throws_ok(
  $$ select public.update_schedule_shift(
    (select shift.id from public.shifts shift join public.schedules schedule on schedule.id = shift.schedule_id
      where shift.notes = 'Edited shift' and schedule.week_start = '2026-08-24' order by shift.start_at limit 1),
    'b4200000-0000-0000-0000-000000000001', null,
    'a4300000-0000-0000-0000-000000000001',
    '2026-08-24 10:00', '2026-08-24 18:00', 45, 'Invalid department'
  ) $$,
  'P0001', 'Department must belong to the shift organization', 'Cross-tenant department assignment is rejected'
);
select throws_ok(
  $$ select public.assign_schedule_shift(
    (select shift.id from public.shifts shift join public.schedules schedule on schedule.id = shift.schedule_id
      where shift.notes = 'Edited shift' and schedule.week_start = '2026-08-24' order by shift.start_at limit 1),
    'b4300000-0000-0000-0000-000000000001'
  ) $$,
  'P0001', 'Employee must be active and belong to the shift organization', 'Cross-tenant employee assignment is rejected'
);

select * from finish();
rollback;
