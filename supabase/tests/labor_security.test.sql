begin;
select plan(40);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '5a000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'gate5-owner-a@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '5a000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'gate5-manager-a@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '5a000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'gate5-employee-a@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '5a000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'gate5-viewer-a@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '5b000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'gate5-owner-b@test.example', null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

set local role authenticated;
set local "request.jwt.claim.sub" = '5a000000-0000-0000-0000-000000000001';
select public.create_organization('Gate 5 Company A', 'gate5-company-a', 'America/New_York');
set local "request.jwt.claim.sub" = '5b000000-0000-0000-0000-000000000001';
select public.create_organization('Gate 5 Company B', 'gate5-company-b', 'America/Chicago');

reset role;
insert into public.organization_memberships (organization_id, profile_id, role_id, membership_role, status)
select organization.id, profile.id, role.id, setup.membership_role, 'active'
from (values
  ('5a000000-0000-0000-0000-000000000002'::uuid, 'Manager'::text, 'manager'::public.membership_role),
  ('5a000000-0000-0000-0000-000000000003'::uuid, 'Employee'::text, 'employee'::public.membership_role)
) setup(auth_user_id, role_name, membership_role)
join public.profiles profile on profile.auth_user_id = setup.auth_user_id
cross join public.organizations organization
join public.roles role on role.organization_id = organization.id and role.name = setup.role_name
where organization.slug = 'gate5-company-a';

insert into public.roles (id, organization_id, name, description)
select '5a010000-0000-0000-0000-000000000001', id, 'Labor Hours Viewer', 'Hours without costs'
from public.organizations where slug = 'gate5-company-a';
insert into public.role_permissions (organization_id, role_id, permission_id)
select organization.id, '5a010000-0000-0000-0000-000000000001', permission.id
from public.organizations organization
join public.permissions permission on permission.capability = 'labor.view'
where organization.slug = 'gate5-company-a';
insert into public.organization_memberships (organization_id, profile_id, role_id, membership_role, status)
select organization.id, profile.id, '5a010000-0000-0000-0000-000000000001', 'manager', 'active'
from public.organizations organization
join public.profiles profile on profile.auth_user_id = '5a000000-0000-0000-0000-000000000004'
where organization.slug = 'gate5-company-a';

insert into public.employees (id, organization_id, profile_id, first_name, last_name, email)
select '5a100000-0000-0000-0000-000000000001', organization.id, profile.id,
  'Avery', 'Employee', 'avery@gate5.example'
from public.organizations organization
join public.profiles profile on profile.auth_user_id = '5a000000-0000-0000-0000-000000000003'
where organization.slug = 'gate5-company-a';
insert into public.employee_compensation (id, organization_id, employee_id, hourly_rate)
select '5a110000-0000-0000-0000-000000000001', id,
  '5a100000-0000-0000-0000-000000000001', 25
from public.organizations where slug = 'gate5-company-a';
insert into public.locations (id, organization_id, name, address, city, state, postal_code)
select '5a200000-0000-0000-0000-000000000001', id, 'Gate 5 Office', '5 Labor Way', 'Sampleville', 'NY', '10001'
from public.organizations where slug = 'gate5-company-a';
insert into public.departments (id, organization_id, location_id, name)
select '5a300000-0000-0000-0000-000000000001', id, '5a200000-0000-0000-0000-000000000001', 'Operations'
from public.organizations where slug = 'gate5-company-a';
insert into public.schedules (id, organization_id, location_id, week_start, status, published_at, published_by, created_by)
select '5a400000-0000-0000-0000-000000000001', organization.id,
  '5a200000-0000-0000-0000-000000000001', '2026-08-17', 'published', now(), profile.id, profile.id
from public.organizations organization
join public.profiles profile on profile.auth_user_id = '5a000000-0000-0000-0000-000000000001'
where organization.slug = 'gate5-company-a';
insert into public.shifts (
  id, organization_id, schedule_id, location_id, department_id, employee_id,
  start_at, end_at, break_minutes, status, created_by
)
select '5a500000-0000-0000-0000-000000000001', organization.id,
  '5a400000-0000-0000-0000-000000000001', '5a200000-0000-0000-0000-000000000001',
  '5a300000-0000-0000-0000-000000000001', '5a100000-0000-0000-0000-000000000001',
  '2026-08-17 13:00+00', '2026-08-17 21:00+00', 30, 'published', profile.id
from public.organizations organization
join public.profiles profile on profile.auth_user_id = '5a000000-0000-0000-0000-000000000001'
where organization.slug = 'gate5-company-a';
insert into public.time_entries (
  id, organization_id, employee_id, shift_id, location_id, clock_in_at, clock_out_at,
  status, source, created_by
)
select '5a600000-0000-0000-0000-000000000001', organization.id,
  '5a100000-0000-0000-0000-000000000001', '5a500000-0000-0000-0000-000000000001',
  '5a200000-0000-0000-0000-000000000001', '2026-08-17 13:00+00', '2026-08-17 21:00+00',
  'completed', 'system', profile.id
from public.organizations organization
join public.profiles profile on profile.auth_user_id = '5a000000-0000-0000-0000-000000000001'
where organization.slug = 'gate5-company-a';
insert into public.time_breaks (id, organization_id, time_entry_id, start_at, end_at)
select '5a700000-0000-0000-0000-000000000001', organization_id, id,
  '2026-08-17 17:00+00', '2026-08-17 17:30+00'
from public.time_entries where id = '5a600000-0000-0000-0000-000000000001';

insert into public.employees (id, organization_id, first_name, last_name, email)
select '5b100000-0000-0000-0000-000000000001', id, 'Blair', 'Employee', 'blair@gate5.example'
from public.organizations where slug = 'gate5-company-b';
insert into public.employee_compensation (id, organization_id, employee_id, hourly_rate)
select '5b110000-0000-0000-0000-000000000001', id,
  '5b100000-0000-0000-0000-000000000001', 99
from public.organizations where slug = 'gate5-company-b';
insert into public.locations (id, organization_id, name, address, city, state, postal_code)
select '5b200000-0000-0000-0000-000000000001', id, 'Company B Office', '9 Other Way', 'Elsewhere', 'IL', '60001'
from public.organizations where slug = 'gate5-company-b';
insert into public.departments (id, organization_id, location_id, name)
select '5b300000-0000-0000-0000-000000000001', id, '5b200000-0000-0000-0000-000000000001', 'Company B Ops'
from public.organizations where slug = 'gate5-company-b';
insert into public.schedules (id, organization_id, location_id, week_start, status, published_at, published_by, created_by)
select '5b400000-0000-0000-0000-000000000001', organization.id,
  '5b200000-0000-0000-0000-000000000001', '2026-08-17', 'published', now(), profile.id, profile.id
from public.organizations organization
join public.profiles profile on profile.auth_user_id = '5b000000-0000-0000-0000-000000000001'
where organization.slug = 'gate5-company-b';
insert into public.shifts (
  id, organization_id, schedule_id, location_id, department_id, employee_id,
  start_at, end_at, break_minutes, status, created_by
)
select '5b500000-0000-0000-0000-000000000001', organization.id,
  '5b400000-0000-0000-0000-000000000001', '5b200000-0000-0000-0000-000000000001',
  '5b300000-0000-0000-0000-000000000001', '5b100000-0000-0000-0000-000000000001',
  '2026-08-17 14:00+00', '2026-08-17 22:00+00', 30, 'published', profile.id
from public.organizations organization
join public.profiles profile on profile.auth_user_id = '5b000000-0000-0000-0000-000000000001'
where organization.slug = 'gate5-company-b';
insert into public.time_entries (
  id, organization_id, employee_id, shift_id, location_id, clock_in_at, clock_out_at,
  status, source, created_by
)
select '5b600000-0000-0000-0000-000000000001', organization.id,
  '5b100000-0000-0000-0000-000000000001', '5b500000-0000-0000-0000-000000000001',
  '5b200000-0000-0000-0000-000000000001', '2026-08-17 14:00+00', '2026-08-17 22:00+00',
  'completed', 'system', profile.id
from public.organizations organization
join public.profiles profile on profile.auth_user_id = '5b000000-0000-0000-0000-000000000001'
where organization.slug = 'gate5-company-b';
insert into public.time_breaks (id, organization_id, time_entry_id, start_at, end_at)
select '5b700000-0000-0000-0000-000000000001', organization_id, id,
  '2026-08-17 18:00+00', '2026-08-17 18:30+00'
from public.time_entries where id = '5b600000-0000-0000-0000-000000000001';

set local role authenticated;
set local "request.jwt.claim.sub" = '5a000000-0000-0000-0000-000000000001';
select ok(public.has_permission((select id from public.organizations where slug = 'gate5-company-a'), 'labor.view'), 'Owner receives labor.view');
select ok(public.has_permission((select id from public.organizations where slug = 'gate5-company-a'), 'labor.view_cost'), 'Owner receives labor.view_cost');
select ok(public.has_permission((select id from public.organizations where slug = 'gate5-company-a'), 'employee_wage.view'), 'Owner retains wage view for authorized costs');

set local "request.jwt.claim.sub" = '5a000000-0000-0000-0000-000000000002';
select ok(public.has_permission((select id from public.organizations where slug = 'gate5-company-a'), 'labor.view'), 'Manager receives labor.view');
select ok(public.has_permission((select id from public.organizations where slug = 'gate5-company-a'), 'labor.view_cost'), 'Manager receives labor.view_cost');
select ok(public.has_permission((select id from public.organizations where slug = 'gate5-company-a'), 'employee_wage.view'), 'Manager receives wage view for authorized costs');

set local "request.jwt.claim.sub" = '5a000000-0000-0000-0000-000000000003';
select ok(not public.has_permission((select id from public.organizations where slug = 'gate5-company-a'), 'labor.view'), 'Employee does not receive labor.view');
select ok(not public.has_permission((select id from public.organizations where slug = 'gate5-company-a'), 'labor.view_cost'), 'Employee does not receive labor.view_cost');
select is((select count(*)::integer from public.employee_compensation), 0, 'Employee cannot read coworker compensation');

set local "request.jwt.claim.sub" = '5a000000-0000-0000-0000-000000000004';
select ok(public.has_permission((select id from public.organizations where slug = 'gate5-company-a'), 'labor.view'), 'Labor-only viewer receives labor.view');
select ok(not public.has_permission((select id from public.organizations where slug = 'gate5-company-a'), 'labor.view_cost'), 'Labor-only viewer lacks labor.view_cost');
select ok(not public.has_permission((select id from public.organizations where slug = 'gate5-company-a'), 'employee_wage.view'), 'Labor-only viewer lacks wage view');
select is((select count(*)::integer from public.employees), 1, 'Labor-only viewer can read own-organization labor employees');
select is((select count(*)::integer from public.shifts), 1, 'Labor-only viewer can read own-organization scheduled inputs');
select is((select count(*)::integer from public.time_entries), 1, 'Labor-only viewer can read own-organization actual inputs');
select is((select count(*)::integer from public.employee_compensation), 0, 'Labor-only viewer receives no compensation rows');
select is((select count(*)::integer from public.employees where id = '5b100000-0000-0000-0000-000000000001'), 0, 'Labor-only viewer cannot read Company B employee input');
select is((select count(*)::integer from public.shifts where id = '5b500000-0000-0000-0000-000000000001'), 0, 'Labor-only viewer cannot read Company B scheduled input');
select is((select count(*)::integer from public.time_entries where id = '5b600000-0000-0000-0000-000000000001'), 0, 'Labor-only viewer cannot read Company B actual input');
select is((select count(*)::integer from public.employee_compensation where id = '5b110000-0000-0000-0000-000000000001'), 0, 'Labor-only viewer cannot read Company B compensation');
select throws_ok($$ update public.shifts set notes = 'Mutated by Labor' where id = '5a500000-0000-0000-0000-000000000001' $$,
  '42501', null, 'Labor-only viewer cannot mutate Scheduling');
select throws_ok($$ update public.time_entries set correction_note = 'Mutated by Labor' where id = '5a600000-0000-0000-0000-000000000001' $$,
  '42501', null, 'Labor-only viewer cannot mutate Time Tracking');
select is_empty($$ update public.employee_compensation set hourly_rate = 1 where id = '5a110000-0000-0000-0000-000000000001' returning id $$,
  'Labor-only viewer cannot mutate compensation');

set local "request.jwt.claim.sub" = '5a000000-0000-0000-0000-000000000002';
select is((select count(*)::integer from public.employee_compensation), 1, 'Manager can read own-organization compensation');
select is((select count(*)::integer from public.shifts), 1, 'Manager can read own-organization scheduled labor');
select is((select count(*)::integer from public.time_entries), 1, 'Manager can read own-organization actual labor');
select is((select count(*)::integer from public.employee_compensation where id = '5b110000-0000-0000-0000-000000000001'), 0, 'Company A manager cannot read Company B compensation');
select is((select count(*)::integer from public.employees where id = '5b100000-0000-0000-0000-000000000001'), 0, 'Company A manager cannot read Company B employee input');
select is((select count(*)::integer from public.schedules where id = '5b400000-0000-0000-0000-000000000001'), 0, 'Company A manager cannot read Company B schedule input');
select is((select count(*)::integer from public.shifts where id = '5b500000-0000-0000-0000-000000000001'), 0, 'Company A manager cannot read Company B shift input');
select is((select count(*)::integer from public.time_entries where id = '5b600000-0000-0000-0000-000000000001'), 0, 'Company A manager cannot read Company B time entry');
select is((select count(*)::integer from public.time_breaks where id = '5b700000-0000-0000-0000-000000000001'), 0, 'Company A manager cannot read Company B time break');

reset role;
delete from public.role_permissions role_permission
using public.roles role, public.permissions permission, public.organizations organization
where role_permission.role_id = role.id
  and role_permission.permission_id = permission.id
  and role.organization_id = organization.id
  and organization.slug = 'gate5-company-a'
  and role.name = 'Manager'
  and permission.capability in ('labor.view_cost', 'employee_wage.view');
set local role authenticated;
set local "request.jwt.claim.sub" = '5a000000-0000-0000-0000-000000000002';
select ok(public.has_permission((select id from public.organizations where slug = 'gate5-company-a'), 'labor.view'), 'Manager retains labor hours permission after cost grants are removed');
select ok(not public.has_permission((select id from public.organizations where slug = 'gate5-company-a'), 'labor.view_cost'), 'Removed labor cost capability stays removed');
select ok(not public.has_permission((select id from public.organizations where slug = 'gate5-company-a'), 'employee_wage.view'), 'Removed wage capability stays removed');
select is((select count(*)::integer from public.employee_compensation), 0, 'Removing wage access prevents compensation visibility');
select is((select count(*)::integer from public.shifts), 1, 'Removing cost access preserves non-cost labor visibility');

reset role;
select ok((select enabled from public.organization_modules module
  join public.organizations organization on organization.id = module.organization_id
  where organization.slug = 'gate5-company-a' and module.module_key = 'labor'),
  'Labor module is enabled for the organization');
select is((select count(*)::integer from public.permissions where capability like 'labor.%'), 2,
  'Exactly two Gate 5 labor capabilities are registered');
select is((select hourly_rate from public.employee_compensation where id = '5a110000-0000-0000-0000-000000000001'),
  25.00::numeric, 'Labor read-only attempts leave compensation unchanged');

select * from finish();
rollback;
