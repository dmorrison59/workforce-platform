-- Local-development data only. All people, addresses, and email domains are fictional.
-- The seeded auth identity deliberately has no working password. Use the sign-up
-- workflow when a local login is needed.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'owner@acme-demo.example',
  null, now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"first_name":"Avery","last_name":"Owner"}'::jsonb,
  now(), now(), '', '', '', ''
) on conflict (id) do nothing;

insert into public.organizations (id, name, slug, timezone)
values (
  '20000000-0000-0000-0000-000000000001',
  'Acme Demo Company', 'acme-demo-company', 'America/New_York'
) on conflict (id) do nothing;

insert into public.roles (id, organization_id, name, description, is_system) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Owner', 'Full organization access', true),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Manager', 'Operational workforce management', true),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Employee', 'Basic workforce directory access', true)
on conflict (id) do nothing;

insert into public.organization_memberships
  (organization_id, profile_id, role_id, membership_role, status)
select
  '20000000-0000-0000-0000-000000000001', p.id,
  '30000000-0000-0000-0000-000000000001', 'owner', 'active'
from public.profiles p
where p.auth_user_id = '10000000-0000-0000-0000-000000000001'
on conflict (organization_id, profile_id) do nothing;

insert into public.role_permissions (organization_id, role_id, permission_id)
select '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', id
from public.permissions
on conflict do nothing;

insert into public.role_permissions (organization_id, role_id, permission_id)
select '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', id
from public.permissions
where capability in ('employee.view', 'employee.manage', 'location.view', 'location.manage', 'department.view', 'department.manage')
on conflict do nothing;

insert into public.role_permissions (organization_id, role_id, permission_id)
select '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', id
from public.permissions
where capability in ('employee.view', 'location.view', 'department.view')
on conflict do nothing;

insert into public.organization_modules (organization_id, module_key)
select '20000000-0000-0000-0000-000000000001', module_key
from unnest(array[
  'scheduling', 'availability', 'time_off', 'open_shifts', 'shift_swaps',
  'time_clock', 'labor', 'messaging', 'crews', 'jobs', 'gps', 'ai_scheduling'
]) as module_key
on conflict do nothing;

insert into public.locations
  (id, organization_id, name, address, city, state, postal_code)
values (
  '40000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'Main Office', '100 Example Avenue', 'Sampleville', 'NY', '10001'
) on conflict (id) do nothing;

insert into public.departments
  (organization_id, location_id, name)
values (
  '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001', 'Operations'
) on conflict (organization_id, name) do nothing;

insert into public.employees
  (organization_id, employee_number, first_name, last_name, email, employment_status, hire_date)
values
  ('20000000-0000-0000-0000-000000000001', 'D-001', 'Jordan', 'Sample', 'jordan@acme-demo.example', 'active', '2026-01-12'),
  ('20000000-0000-0000-0000-000000000001', 'D-002', 'Taylor', 'Example', 'taylor@acme-demo.example', 'active', '2026-02-02')
on conflict (organization_id, employee_number) do nothing;
