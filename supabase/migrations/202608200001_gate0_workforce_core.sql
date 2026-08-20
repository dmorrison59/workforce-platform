-- Gate 0 / Module 0: secure workforce core.
-- Rollback: drop the public schema objects created below in reverse dependency order.

create extension if not exists pgcrypto with schema extensions;

create type public.membership_role as enum ('owner', 'manager', 'employee');
create type public.membership_status as enum ('active', 'invited', 'suspended');
create type public.employment_status as enum ('active', 'inactive', 'terminated');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  capability text not null unique check (capability ~ '^[a-z_]+\.[a-z_]+$'),
  description text not null,
  created_at timestamptz not null default now()
);

comment on table public.permissions is
  'Global capability registry. This is intentionally not tenant-owned; grants are tenant-scoped through role_permissions.';

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (id, organization_id)
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null,
  membership_role public.membership_role not null,
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, profile_id),
  unique (id, organization_id),
  foreign key (role_id, organization_id)
    references public.roles(id, organization_id) on delete restrict
);

create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_id uuid not null,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (organization_id, role_id, permission_id),
  foreign key (role_id, organization_id)
    references public.roles(id, organization_id) on delete cascade
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  employee_number text,
  first_name text not null check (char_length(trim(first_name)) between 1 and 80),
  last_name text not null check (char_length(trim(last_name)) between 1 and 80),
  email text not null check (position('@' in email) > 1),
  phone text,
  employment_status public.employment_status not null default 'active',
  hire_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, employee_number),
  unique (id, organization_id)
);

create table public.employee_compensation (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null,
  hourly_rate numeric(10, 2) check (hourly_rate is null or hourly_rate >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, employee_id),
  foreign key (employee_id, organization_id)
    references public.employees(id, organization_id) on delete cascade
);

comment on table public.employee_compensation is
  'Compensation is separated from broad employee records so wage access has independent capabilities and RLS.';

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  address text not null,
  city text not null,
  state text not null,
  postal_code text not null,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (id, organization_id)
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (id, organization_id),
  foreign key (location_id, organization_id)
    references public.locations(id, organization_id) on delete restrict
);

create table public.employee_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null,
  role_id uuid not null,
  created_at timestamptz not null default now(),
  unique (organization_id, employee_id, role_id),
  foreign key (employee_id, organization_id)
    references public.employees(id, organization_id) on delete cascade,
  foreign key (role_id, organization_id)
    references public.roles(id, organization_id) on delete cascade
);

create table public.organization_modules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_key text not null check (module_key ~ '^[a-z][a-z0-9_]*$'),
  enabled boolean not null default false,
  settings_json jsonb not null default '{}'::jsonb check (jsonb_typeof(settings_json) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, module_key)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_record jsonb,
  new_record jsonb,
  created_at timestamptz not null default now()
);

create index organization_memberships_profile_idx
  on public.organization_memberships(profile_id, status);
create index employees_organization_idx on public.employees(organization_id);
create index locations_organization_idx on public.locations(organization_id);
create index departments_organization_idx on public.departments(organization_id);
create index audit_events_organization_created_idx
  on public.audit_events(organization_id, created_at desc);

insert into public.permissions (capability, description) values
  ('employee.view', 'View employee directory records'),
  ('employee.manage', 'Create and update employee directory records'),
  ('employee_wage.view', 'View protected employee compensation'),
  ('employee_wage.manage', 'Create and update protected employee compensation'),
  ('location.view', 'View organization locations'),
  ('location.manage', 'Create and update organization locations'),
  ('department.view', 'View organization departments'),
  ('department.manage', 'Create and update organization departments'),
  ('settings.manage', 'Manage organization settings, roles, and modules');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.validate_organization_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Unknown IANA timezone: %', new.timezone;
  end if;
  return new;
end;
$$;

create or replace function public.validate_employee_profile_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.profile_id is not null and not exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = new.organization_id
      and membership.profile_id = new.profile_id
      and membership.status = 'active'
  ) then
    raise exception 'Employee profile must have an active membership in the same organization';
  end if;
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger organizations_set_updated_at before update on public.organizations
for each row execute function public.set_updated_at();
create trigger organizations_validate_timezone before insert or update of timezone on public.organizations
for each row execute function public.validate_organization_timezone();
create trigger roles_set_updated_at before update on public.roles
for each row execute function public.set_updated_at();
create trigger memberships_set_updated_at before update on public.organization_memberships
for each row execute function public.set_updated_at();
create trigger employees_set_updated_at before update on public.employees
for each row execute function public.set_updated_at();
create trigger employees_validate_profile before insert or update of profile_id, organization_id on public.employees
for each row execute function public.validate_employee_profile_scope();
create trigger compensation_set_updated_at before update on public.employee_compensation
for each row execute function public.set_updated_at();
create trigger locations_set_updated_at before update on public.locations
for each row execute function public.set_updated_at();
create trigger departments_set_updated_at before update on public.departments
for each row execute function public.set_updated_at();
create trigger modules_set_updated_at before update on public.organization_modules
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (auth_user_id, first_name, last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', '')
  )
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.profiles where auth_user_id = auth.uid();
$$;

create or replace function public.has_active_membership(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    join public.profiles profile on profile.id = membership.profile_id
    where profile.auth_user_id = auth.uid()
      and membership.organization_id = target_organization_id
      and membership.status = 'active'
  );
$$;

create or replace function public.shares_organization(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships mine
    join public.organization_memberships theirs
      on theirs.organization_id = mine.organization_id
    where mine.profile_id = public.current_profile_id()
      and mine.status = 'active'
      and theirs.profile_id = target_profile_id
      and theirs.status = 'active'
  );
$$;

create or replace function public.has_permission(
  target_organization_id uuid,
  requested_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    join public.profiles profile on profile.id = membership.profile_id
    join public.role_permissions role_permission
      on role_permission.organization_id = membership.organization_id
     and role_permission.role_id = membership.role_id
    join public.permissions permission on permission.id = role_permission.permission_id
    where profile.auth_user_id = auth.uid()
      and membership.organization_id = target_organization_id
      and membership.status = 'active'
      and permission.capability = requested_capability
  );
$$;

create or replace function public.create_organization(
  organization_name text,
  organization_slug text,
  organization_timezone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_organization_id uuid;
  owner_role_id uuid;
  manager_role_id uuid;
  employee_role_id uuid;
  creator_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if char_length(trim(organization_name)) not between 2 and 120 then
    raise exception 'Organization name must contain 2 to 120 characters';
  end if;

  if lower(trim(organization_slug)) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Organization slug is invalid';
  end if;

  select id into creator_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if creator_profile_id is null then
    insert into public.profiles (auth_user_id)
    values (auth.uid())
    returning id into creator_profile_id;
  end if;

  insert into public.organizations (name, slug, timezone)
  values (trim(organization_name), lower(trim(organization_slug)), organization_timezone)
  returning id into new_organization_id;

  insert into public.roles (organization_id, name, description, is_system)
  values (new_organization_id, 'Owner', 'Full organization access', true)
  returning id into owner_role_id;

  insert into public.roles (organization_id, name, description, is_system)
  values (new_organization_id, 'Manager', 'Operational workforce management', true)
  returning id into manager_role_id;

  insert into public.roles (organization_id, name, description, is_system)
  values (new_organization_id, 'Employee', 'Basic workforce directory access', true)
  returning id into employee_role_id;

  insert into public.organization_memberships
    (organization_id, profile_id, role_id, membership_role, status)
  values
    (new_organization_id, creator_profile_id, owner_role_id, 'owner', 'active');

  insert into public.role_permissions (organization_id, role_id, permission_id)
  select new_organization_id, owner_role_id, id from public.permissions;

  insert into public.role_permissions (organization_id, role_id, permission_id)
  select new_organization_id, manager_role_id, id
  from public.permissions
  where capability in (
    'employee.view', 'employee.manage',
    'location.view', 'location.manage',
    'department.view', 'department.manage'
  );

  insert into public.role_permissions (organization_id, role_id, permission_id)
  select new_organization_id, employee_role_id, id
  from public.permissions
  where capability in ('employee.view', 'location.view', 'department.view');

  insert into public.organization_modules (organization_id, module_key)
  select new_organization_id, module_key
  from unnest(array[
    'scheduling', 'availability', 'time_off', 'open_shifts', 'shift_swaps',
    'time_clock', 'labor', 'messaging', 'crews', 'jobs', 'gps', 'ai_scheduling'
  ]) as module_key;

  return new_organization_id;
end;
$$;

create or replace function public.create_employee(
  target_organization_id uuid,
  employee_first_name text,
  employee_last_name text,
  employee_email text,
  employee_phone text default null,
  employee_number_value text default null,
  employee_status public.employment_status default 'active',
  employee_hire_date date default null,
  employee_hourly_rate numeric default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_employee_id uuid;
begin
  if not public.has_permission(target_organization_id, 'employee.manage') then
    raise exception 'Employee management permission required' using errcode = '42501';
  end if;

  if employee_hourly_rate is not null
     and not public.has_permission(target_organization_id, 'employee_wage.manage') then
    raise exception 'Employee wage management permission required' using errcode = '42501';
  end if;

  insert into public.employees (
    organization_id, employee_number, first_name, last_name, email, phone,
    employment_status, hire_date
  ) values (
    target_organization_id, nullif(trim(employee_number_value), ''),
    trim(employee_first_name), trim(employee_last_name), lower(trim(employee_email)),
    nullif(trim(employee_phone), ''), employee_status, employee_hire_date
  ) returning id into new_employee_id;

  if employee_hourly_rate is not null then
    insert into public.employee_compensation (organization_id, employee_id, hourly_rate)
    values (target_organization_id, new_employee_id, employee_hourly_rate);
  end if;

  return new_employee_id;
end;
$$;

create or replace function public.capture_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_record jsonb;
  source_id uuid;
  source_organization_id uuid;
begin
  source_record := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  source_id := (source_record ->> 'id')::uuid;
  source_organization_id := (source_record ->> 'organization_id')::uuid;

  insert into public.audit_events (
    organization_id, actor_profile_id, table_name, record_id, action,
    old_record, new_record
  ) values (
    source_organization_id,
    public.current_profile_id(),
    tg_table_name,
    source_id,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create trigger employees_audit after insert or update or delete on public.employees
for each row execute function public.capture_audit_event();
create trigger locations_audit after insert or update or delete on public.locations
for each row execute function public.capture_audit_event();
create trigger departments_audit after insert or update or delete on public.departments
for each row execute function public.capture_audit_event();
create trigger modules_audit after insert or update or delete on public.organization_modules
for each row execute function public.capture_audit_event();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.role_permissions enable row level security;
alter table public.employees enable row level security;
alter table public.employee_compensation enable row level security;
alter table public.locations enable row level security;
alter table public.departments enable row level security;
alter table public.employee_roles enable row level security;
alter table public.organization_modules enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select_shared_org on public.profiles for select to authenticated
using (id = public.current_profile_id() or public.shares_organization(id));
create policy profiles_update_self on public.profiles for update to authenticated
using (id = public.current_profile_id()) with check (id = public.current_profile_id());

create policy organizations_select_member on public.organizations for select to authenticated
using (public.has_active_membership(id));
create policy organizations_update_settings on public.organizations for update to authenticated
using (public.has_permission(id, 'settings.manage'))
with check (public.has_permission(id, 'settings.manage'));

create policy permissions_select_authenticated on public.permissions for select to authenticated
using (true);

create policy roles_select_member on public.roles for select to authenticated
using (public.has_active_membership(organization_id));
create policy roles_insert_settings on public.roles for insert to authenticated
with check (public.has_permission(organization_id, 'settings.manage'));
create policy roles_update_settings on public.roles for update to authenticated
using (public.has_permission(organization_id, 'settings.manage'))
with check (public.has_permission(organization_id, 'settings.manage'));
create policy roles_delete_settings on public.roles for delete to authenticated
using (public.has_permission(organization_id, 'settings.manage') and not is_system);

create policy memberships_select_member on public.organization_memberships for select to authenticated
using (public.has_active_membership(organization_id));
create policy memberships_insert_settings on public.organization_memberships for insert to authenticated
with check (public.has_permission(organization_id, 'settings.manage'));
create policy memberships_update_settings on public.organization_memberships for update to authenticated
using (public.has_permission(organization_id, 'settings.manage'))
with check (public.has_permission(organization_id, 'settings.manage'));
create policy memberships_delete_settings on public.organization_memberships for delete to authenticated
using (public.has_permission(organization_id, 'settings.manage'));

create policy role_permissions_select_member on public.role_permissions for select to authenticated
using (public.has_active_membership(organization_id));
create policy role_permissions_insert_settings on public.role_permissions for insert to authenticated
with check (public.has_permission(organization_id, 'settings.manage'));
create policy role_permissions_delete_settings on public.role_permissions for delete to authenticated
using (public.has_permission(organization_id, 'settings.manage'));

create policy employees_select_capability on public.employees for select to authenticated
using (public.has_permission(organization_id, 'employee.view'));
create policy employees_insert_capability on public.employees for insert to authenticated
with check (public.has_permission(organization_id, 'employee.manage'));
create policy employees_update_capability on public.employees for update to authenticated
using (public.has_permission(organization_id, 'employee.manage'))
with check (public.has_permission(organization_id, 'employee.manage'));
create policy employees_delete_capability on public.employees for delete to authenticated
using (public.has_permission(organization_id, 'employee.manage'));

create policy compensation_select_capability on public.employee_compensation for select to authenticated
using (public.has_permission(organization_id, 'employee_wage.view'));
create policy compensation_insert_capability on public.employee_compensation for insert to authenticated
with check (public.has_permission(organization_id, 'employee_wage.manage'));
create policy compensation_update_capability on public.employee_compensation for update to authenticated
using (public.has_permission(organization_id, 'employee_wage.manage'))
with check (public.has_permission(organization_id, 'employee_wage.manage'));
create policy compensation_delete_capability on public.employee_compensation for delete to authenticated
using (public.has_permission(organization_id, 'employee_wage.manage'));

create policy locations_select_capability on public.locations for select to authenticated
using (public.has_permission(organization_id, 'location.view'));
create policy locations_insert_capability on public.locations for insert to authenticated
with check (public.has_permission(organization_id, 'location.manage'));
create policy locations_update_capability on public.locations for update to authenticated
using (public.has_permission(organization_id, 'location.manage'))
with check (public.has_permission(organization_id, 'location.manage'));
create policy locations_delete_capability on public.locations for delete to authenticated
using (public.has_permission(organization_id, 'location.manage'));

create policy departments_select_capability on public.departments for select to authenticated
using (public.has_permission(organization_id, 'department.view'));
create policy departments_insert_capability on public.departments for insert to authenticated
with check (public.has_permission(organization_id, 'department.manage'));
create policy departments_update_capability on public.departments for update to authenticated
using (public.has_permission(organization_id, 'department.manage'))
with check (public.has_permission(organization_id, 'department.manage'));
create policy departments_delete_capability on public.departments for delete to authenticated
using (public.has_permission(organization_id, 'department.manage'));

create policy employee_roles_select_capability on public.employee_roles for select to authenticated
using (public.has_permission(organization_id, 'employee.view'));
create policy employee_roles_insert_capability on public.employee_roles for insert to authenticated
with check (public.has_permission(organization_id, 'employee.manage'));
create policy employee_roles_delete_capability on public.employee_roles for delete to authenticated
using (public.has_permission(organization_id, 'employee.manage'));

create policy modules_select_member on public.organization_modules for select to authenticated
using (public.has_active_membership(organization_id));
create policy modules_insert_settings on public.organization_modules for insert to authenticated
with check (public.has_permission(organization_id, 'settings.manage'));
create policy modules_update_settings on public.organization_modules for update to authenticated
using (public.has_permission(organization_id, 'settings.manage'))
with check (public.has_permission(organization_id, 'settings.manage'));
create policy modules_delete_settings on public.organization_modules for delete to authenticated
using (public.has_permission(organization_id, 'settings.manage'));

create policy audit_events_select_settings on public.audit_events for select to authenticated
using (public.has_permission(organization_id, 'settings.manage'));

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.organizations to authenticated;
grant select on public.permissions to authenticated;
grant select, insert, update, delete on public.roles to authenticated;
grant select, insert, update, delete on public.organization_memberships to authenticated;
grant select, insert, delete on public.role_permissions to authenticated;
grant select, insert, update, delete on public.employees to authenticated;
grant select, insert, update, delete on public.employee_compensation to authenticated;
grant select, insert, update, delete on public.locations to authenticated;
grant select, insert, update, delete on public.departments to authenticated;
grant select, insert, delete on public.employee_roles to authenticated;
grant select, insert, update, delete on public.organization_modules to authenticated;
grant select on public.audit_events to authenticated;
grant usage, select on sequence public.audit_events_id_seq to authenticated;

revoke all on function public.create_organization(text, text, text) from public;
grant execute on function public.create_organization(text, text, text) to authenticated;
revoke all on function public.create_employee(uuid, text, text, text, text, text, public.employment_status, date, numeric) from public;
grant execute on function public.create_employee(uuid, text, text, text, text, text, public.employment_status, date, numeric) to authenticated;
grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.has_active_membership(uuid) to authenticated;
grant execute on function public.has_permission(uuid, text) to authenticated;

comment on table public.organizations is
  'Tenant root; organization_id is intentionally absent because each row is the tenant itself.';
comment on table public.profiles is
  'Global login-adjacent profile; organization access is connected through tenant-scoped memberships.';
