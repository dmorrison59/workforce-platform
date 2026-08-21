-- Gate 1: tenant-scoped weekly scheduling.

create type public.schedule_status as enum ('draft', 'published');
create type public.shift_status as enum ('draft', 'published', 'open', 'completed', 'cancelled');

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null,
  week_start date not null check (extract(isodow from week_start) = 1),
  status public.schedule_status not null default 'draft',
  published_at timestamptz,
  published_by uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, location_id, week_start),
  unique (id, organization_id),
  unique (id, organization_id, location_id),
  foreign key (location_id, organization_id)
    references public.locations(id, organization_id) on delete restrict,
  check (
    (status = 'draft' and published_at is null and published_by is null)
    or (status = 'published' and published_at is not null and published_by is not null)
  )
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  schedule_id uuid not null,
  location_id uuid not null,
  department_id uuid not null,
  role_id uuid,
  employee_id uuid,
  start_at timestamptz not null,
  end_at timestamptz not null,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  status public.shift_status not null default 'draft',
  notes text not null default '' check (char_length(notes) <= 2000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (schedule_id, organization_id, location_id)
    references public.schedules(id, organization_id, location_id) on delete cascade,
  foreign key (location_id, organization_id)
    references public.locations(id, organization_id) on delete restrict,
  foreign key (department_id, organization_id)
    references public.departments(id, organization_id) on delete restrict,
  foreign key (role_id, organization_id)
    references public.roles(id, organization_id) on delete restrict,
  foreign key (employee_id, organization_id)
    references public.employees(id, organization_id) on delete restrict,
  check (end_at > start_at),
  check (break_minutes <= extract(epoch from (end_at - start_at)) / 60)
);

create index schedules_org_week_idx
  on public.schedules(organization_id, week_start, location_id);
create index shifts_schedule_start_idx on public.shifts(schedule_id, start_at);
create index shifts_employee_start_idx
  on public.shifts(organization_id, employee_id, start_at)
  where employee_id is not null and status <> 'cancelled';

insert into public.permissions (capability, description) values
  ('schedule.view', 'View schedules allowed by scheduling visibility rules'),
  ('schedule.manage', 'Create and manage draft schedules and shifts'),
  ('schedule.publish', 'Publish schedules for employee visibility');

insert into public.role_permissions (organization_id, role_id, permission_id)
select role.organization_id, role.id, permission.id
from public.roles role
join public.permissions permission
  on permission.capability in ('schedule.view', 'schedule.manage', 'schedule.publish')
where role.is_system and role.name in ('Owner', 'Manager')
on conflict do nothing;

insert into public.role_permissions (organization_id, role_id, permission_id)
select role.organization_id, role.id, permission.id
from public.roles role
join public.permissions permission on permission.capability = 'schedule.view'
where role.is_system and role.name = 'Employee'
on conflict do nothing;

update public.organization_modules
set enabled = true
where module_key = 'scheduling';

create or replace function public.grant_scheduling_role_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_system and new.name = 'Manager' then
    insert into public.role_permissions (organization_id, role_id, permission_id)
    select new.organization_id, new.id, permission.id
    from public.permissions permission
    where permission.capability in ('schedule.view', 'schedule.manage', 'schedule.publish')
    on conflict do nothing;
  elsif new.is_system and new.name = 'Employee' then
    insert into public.role_permissions (organization_id, role_id, permission_id)
    select new.organization_id, new.id, permission.id
    from public.permissions permission
    where permission.capability = 'schedule.view'
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger roles_grant_scheduling_permissions
after insert on public.roles
for each row execute function public.grant_scheduling_role_permissions();

create or replace function public.enable_scheduling_module()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.module_key = 'scheduling' then
    new.enabled = true;
  end if;
  return new;
end;
$$;

create trigger modules_enable_scheduling
before insert on public.organization_modules
for each row execute function public.enable_scheduling_module();

create or replace function public.current_employee_id(target_organization_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select employee.id
  from public.employees employee
  where employee.organization_id = target_organization_id
    and employee.profile_id = public.current_profile_id()
    and employee.employment_status = 'active'
  order by employee.created_at
  limit 1;
$$;

create or replace function public.validate_shift_scope_and_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  department_location_id uuid;
begin
  select department.location_id into department_location_id
  from public.departments department
  where department.id = new.department_id
    and department.organization_id = new.organization_id;

  if not found then
    raise exception 'Department must belong to the shift organization';
  end if;
  if department_location_id is not null and department_location_id <> new.location_id then
    raise exception 'Department must belong to the shift location';
  end if;
  if new.employee_id is not null and not exists (
    select 1 from public.employees employee
    where employee.id = new.employee_id
      and employee.organization_id = new.organization_id
      and employee.employment_status = 'active'
  ) then
    raise exception 'Employee must be active and belong to the shift organization';
  end if;
  if new.role_id is not null and not exists (
    select 1 from public.roles role
    where role.id = new.role_id and role.organization_id = new.organization_id
  ) then
    raise exception 'Role must belong to the shift organization';
  end if;
  if new.employee_id is not null and new.status <> 'cancelled' and exists (
    select 1 from public.shifts existing
    where existing.organization_id = new.organization_id
      and existing.employee_id = new.employee_id
      and existing.id <> new.id
      and existing.status <> 'cancelled'
      and tstzrange(existing.start_at, existing.end_at, '[)')
          && tstzrange(new.start_at, new.end_at, '[)')
  ) then
    raise exception 'Employee already has an overlapping shift';
  end if;
  return new;
end;
$$;

create trigger schedules_set_updated_at before update on public.schedules
for each row execute function public.set_updated_at();
create trigger shifts_set_updated_at before update on public.shifts
for each row execute function public.set_updated_at();
create trigger shifts_validate before insert or update on public.shifts
for each row execute function public.validate_shift_scope_and_overlap();
create trigger schedules_audit after insert or update or delete on public.schedules
for each row execute function public.capture_audit_event();
create trigger shifts_audit after insert or update or delete on public.shifts
for each row execute function public.capture_audit_event();

alter table public.schedules enable row level security;
alter table public.shifts enable row level security;

create or replace function public.employee_can_view_schedule(
  target_schedule_id uuid,
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shifts shift
    where shift.schedule_id = target_schedule_id
      and shift.organization_id = target_organization_id
      and shift.status = 'published'
      and shift.employee_id = public.current_employee_id(target_organization_id)
  );
$$;

create or replace function public.schedule_is_published(
  target_schedule_id uuid,
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.schedules schedule
    where schedule.id = target_schedule_id
      and schedule.organization_id = target_organization_id
      and schedule.status = 'published'
  );
$$;

create policy schedules_select_capability on public.schedules for select to authenticated
using (
  public.has_permission(organization_id, 'schedule.manage')
  or (
    status = 'published'
    and public.has_permission(organization_id, 'schedule.view')
    and public.employee_can_view_schedule(id, organization_id)
  )
);
create policy schedules_insert_capability on public.schedules for insert to authenticated
with check (public.has_permission(organization_id, 'schedule.manage'));
create policy schedules_update_capability on public.schedules for update to authenticated
using (public.has_permission(organization_id, 'schedule.manage'))
with check (public.has_permission(organization_id, 'schedule.manage'));
create policy schedules_delete_capability on public.schedules for delete to authenticated
using (public.has_permission(organization_id, 'schedule.manage'));

create policy shifts_select_capability on public.shifts for select to authenticated
using (
  public.has_permission(organization_id, 'schedule.manage')
  or (
    status = 'published'
    and public.has_permission(organization_id, 'schedule.view')
    and employee_id = public.current_employee_id(organization_id)
    and public.schedule_is_published(schedule_id, organization_id)
  )
);
create policy shifts_insert_capability on public.shifts for insert to authenticated
with check (public.has_permission(organization_id, 'schedule.manage'));
create policy shifts_update_capability on public.shifts for update to authenticated
using (public.has_permission(organization_id, 'schedule.manage'))
with check (public.has_permission(organization_id, 'schedule.manage'));
create policy shifts_delete_capability on public.shifts for delete to authenticated
using (public.has_permission(organization_id, 'schedule.manage'));

create or replace function public.create_weekly_schedule(
  target_organization_id uuid,
  target_location_id uuid,
  target_week_start date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_schedule_id uuid;
begin
  if not public.has_permission(target_organization_id, 'schedule.manage') then
    raise exception 'Schedule management permission required' using errcode = '42501';
  end if;
  if extract(isodow from target_week_start) <> 1 then
    raise exception 'Schedule week must start on Monday';
  end if;
  if not exists (
    select 1 from public.locations location
    where location.id = target_location_id
      and location.organization_id = target_organization_id
      and location.active
  ) then
    raise exception 'Location must be active and belong to the organization';
  end if;

  insert into public.schedules (
    organization_id, location_id, week_start, created_by
  ) values (
    target_organization_id, target_location_id, target_week_start,
    public.current_profile_id()
  )
  on conflict (organization_id, location_id, week_start)
  do update set updated_at = public.schedules.updated_at
  returning id into new_schedule_id;
  return new_schedule_id;
end;
$$;

create or replace function public.create_schedule_shift(
  target_schedule_id uuid,
  target_department_id uuid,
  target_role_id uuid,
  target_employee_id uuid,
  shift_start_local timestamp without time zone,
  shift_end_local timestamp without time zone,
  shift_break_minutes integer default 0,
  shift_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_schedule public.schedules%rowtype;
  organization_timezone text;
  new_shift_id uuid;
  resolved_start timestamptz;
  resolved_end timestamptz;
begin
  select schedule.* into target_schedule
  from public.schedules schedule where schedule.id = target_schedule_id;
  if not found or not public.has_permission(target_schedule.organization_id, 'schedule.manage') then
    raise exception 'Schedule management permission required' using errcode = '42501';
  end if;
  select timezone into organization_timezone from public.organizations
  where id = target_schedule.organization_id;
  resolved_start := shift_start_local at time zone organization_timezone;
  resolved_end := shift_end_local at time zone organization_timezone;
  if resolved_end <= resolved_start then
    raise exception 'Shift end time must be after start time';
  end if;
  if resolved_start < target_schedule.week_start::timestamp at time zone organization_timezone
     or resolved_start >= (target_schedule.week_start + 7)::timestamp at time zone organization_timezone then
    raise exception 'Shift must start within the schedule week';
  end if;

  insert into public.shifts (
    organization_id, schedule_id, location_id, department_id, role_id,
    employee_id, start_at, end_at, break_minutes, notes, created_by
  ) values (
    target_schedule.organization_id, target_schedule.id, target_schedule.location_id,
    target_department_id, target_role_id, target_employee_id, resolved_start,
    resolved_end, shift_break_minutes, coalesce(shift_notes, ''), public.current_profile_id()
  ) returning id into new_shift_id;

  update public.schedules set status = 'draft', published_at = null, published_by = null
  where id = target_schedule.id;
  return new_shift_id;
end;
$$;

create or replace function public.update_schedule_shift(
  target_shift_id uuid,
  target_department_id uuid,
  target_role_id uuid,
  target_employee_id uuid,
  shift_start_local timestamp without time zone,
  shift_end_local timestamp without time zone,
  shift_break_minutes integer,
  shift_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_shift public.shifts%rowtype;
  target_schedule public.schedules%rowtype;
  organization_timezone text;
  resolved_start timestamptz;
  resolved_end timestamptz;
begin
  select shift.* into target_shift from public.shifts shift where shift.id = target_shift_id;
  if not found or not public.has_permission(target_shift.organization_id, 'schedule.manage') then
    raise exception 'Schedule management permission required' using errcode = '42501';
  end if;
  select schedule.* into target_schedule from public.schedules schedule
  where schedule.id = target_shift.schedule_id;
  select timezone into organization_timezone from public.organizations
  where id = target_shift.organization_id;
  resolved_start := shift_start_local at time zone organization_timezone;
  resolved_end := shift_end_local at time zone organization_timezone;
  if resolved_end <= resolved_start then
    raise exception 'Shift end time must be after start time';
  end if;
  if resolved_start < target_schedule.week_start::timestamp at time zone organization_timezone
     or resolved_start >= (target_schedule.week_start + 7)::timestamp at time zone organization_timezone then
    raise exception 'Shift must start within the schedule week';
  end if;

  update public.shifts set
    department_id = target_department_id,
    role_id = target_role_id,
    employee_id = target_employee_id,
    start_at = resolved_start,
    end_at = resolved_end,
    break_minutes = shift_break_minutes,
    notes = coalesce(shift_notes, ''),
    status = 'draft'
  where id = target_shift.id;
  update public.schedules set status = 'draft', published_at = null, published_by = null
  where id = target_shift.schedule_id;
end;
$$;

create or replace function public.delete_schedule_shift(target_shift_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_shift public.shifts%rowtype;
begin
  select shift.* into target_shift from public.shifts shift where shift.id = target_shift_id;
  if not found or not public.has_permission(target_shift.organization_id, 'schedule.manage') then
    raise exception 'Schedule management permission required' using errcode = '42501';
  end if;
  delete from public.shifts where id = target_shift.id;
  update public.schedules set status = 'draft', published_at = null, published_by = null
  where id = target_shift.schedule_id;
end;
$$;

create or replace function public.assign_schedule_shift(
  target_shift_id uuid,
  target_employee_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_shift public.shifts%rowtype;
begin
  select shift.* into target_shift from public.shifts shift where shift.id = target_shift_id;
  if not found or not public.has_permission(target_shift.organization_id, 'schedule.manage') then
    raise exception 'Schedule management permission required' using errcode = '42501';
  end if;
  update public.shifts set employee_id = target_employee_id, status = 'draft'
  where id = target_shift.id;
  update public.schedules set status = 'draft', published_at = null, published_by = null
  where id = target_shift.schedule_id;
end;
$$;

create or replace function public.remove_schedule_shift_employee(target_shift_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_shift public.shifts%rowtype;
begin
  select shift.* into target_shift from public.shifts shift where shift.id = target_shift_id;
  if not found or not public.has_permission(target_shift.organization_id, 'schedule.manage') then
    raise exception 'Schedule management permission required' using errcode = '42501';
  end if;
  update public.shifts set employee_id = null, status = 'draft'
  where id = target_shift.id;
  update public.schedules set status = 'draft', published_at = null, published_by = null
  where id = target_shift.schedule_id;
end;
$$;

create or replace function public.publish_weekly_schedule(target_schedule_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_schedule public.schedules%rowtype;
begin
  select schedule.* into target_schedule
  from public.schedules schedule where schedule.id = target_schedule_id;
  if not found or not public.has_permission(target_schedule.organization_id, 'schedule.publish') then
    raise exception 'Schedule publishing permission required' using errcode = '42501';
  end if;
  update public.shifts set status = 'published'
  where schedule_id = target_schedule.id and status <> 'cancelled';
  update public.schedules set
    status = 'published', published_at = now(), published_by = public.current_profile_id()
  where id = target_schedule.id;
end;
$$;

create or replace function public.copy_schedule_shift(
  source_shift_id uuid,
  target_local_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_shift public.shifts%rowtype;
  source_schedule public.schedules%rowtype;
  organization_timezone text;
  source_start_local timestamp;
  source_end_local timestamp;
  new_start_local timestamp;
  new_end_local timestamp;
begin
  select shift.* into source_shift from public.shifts shift where shift.id = source_shift_id;
  if not found or not public.has_permission(source_shift.organization_id, 'schedule.manage') then
    raise exception 'Schedule management permission required' using errcode = '42501';
  end if;
  select schedule.* into source_schedule from public.schedules schedule
  where schedule.id = source_shift.schedule_id;
  if target_local_date < source_schedule.week_start
     or target_local_date >= source_schedule.week_start + 7 then
    raise exception 'Copied shift date must be within the schedule week';
  end if;
  select timezone into organization_timezone from public.organizations
  where id = source_shift.organization_id;
  source_start_local := source_shift.start_at at time zone organization_timezone;
  source_end_local := source_shift.end_at at time zone organization_timezone;
  new_start_local := target_local_date::timestamp + source_start_local::time;
  new_end_local := new_start_local + (source_end_local - source_start_local);
  return public.create_schedule_shift(
    source_shift.schedule_id, source_shift.department_id, source_shift.role_id,
    source_shift.employee_id, new_start_local, new_end_local,
    source_shift.break_minutes, source_shift.notes
  );
end;
$$;

create or replace function public.copy_schedule_week(
  source_schedule_id uuid,
  target_week_start date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_schedule public.schedules%rowtype;
  new_schedule_id uuid;
  day_offset integer;
  organization_timezone text;
begin
  select schedule.* into source_schedule from public.schedules schedule
  where schedule.id = source_schedule_id;
  if not found or not public.has_permission(source_schedule.organization_id, 'schedule.manage') then
    raise exception 'Schedule management permission required' using errcode = '42501';
  end if;
  if extract(isodow from target_week_start) <> 1 then
    raise exception 'Schedule week must start on Monday';
  end if;
  new_schedule_id := public.create_weekly_schedule(
    source_schedule.organization_id, source_schedule.location_id, target_week_start
  );
  if exists (select 1 from public.shifts where schedule_id = new_schedule_id) then
    raise exception 'Target schedule already contains shifts';
  end if;
  day_offset := target_week_start - source_schedule.week_start;
  select timezone into organization_timezone from public.organizations
  where id = source_schedule.organization_id;
  insert into public.shifts (
    organization_id, schedule_id, location_id, department_id, role_id,
    employee_id, start_at, end_at, break_minutes, status, notes, created_by
  )
  select source_shift.organization_id, new_schedule_id, source_shift.location_id,
    source_shift.department_id, source_shift.role_id, source_shift.employee_id,
    ((source_shift.start_at at time zone organization_timezone) + make_interval(days => day_offset)) at time zone organization_timezone,
    ((source_shift.end_at at time zone organization_timezone) + make_interval(days => day_offset)) at time zone organization_timezone,
    source_shift.break_minutes,
    'draft', source_shift.notes, public.current_profile_id()
  from public.shifts source_shift
  where source_shift.schedule_id = source_schedule.id
    and source_shift.status <> 'cancelled';
  return new_schedule_id;
end;
$$;

revoke all on public.schedules, public.shifts from anon;
revoke all on public.schedules, public.shifts from authenticated;
grant select on public.schedules, public.shifts to authenticated;

revoke all on function public.current_employee_id(uuid) from public;
grant execute on function public.current_employee_id(uuid) to authenticated;
revoke all on function public.employee_can_view_schedule(uuid, uuid) from public;
grant execute on function public.employee_can_view_schedule(uuid, uuid) to authenticated;
revoke all on function public.schedule_is_published(uuid, uuid) from public;
grant execute on function public.schedule_is_published(uuid, uuid) to authenticated;
revoke all on function public.create_weekly_schedule(uuid, uuid, date) from public;
grant execute on function public.create_weekly_schedule(uuid, uuid, date) to authenticated;
revoke all on function public.create_schedule_shift(uuid, uuid, uuid, uuid, timestamp, timestamp, integer, text) from public;
grant execute on function public.create_schedule_shift(uuid, uuid, uuid, uuid, timestamp, timestamp, integer, text) to authenticated;
revoke all on function public.update_schedule_shift(uuid, uuid, uuid, uuid, timestamp, timestamp, integer, text) from public;
grant execute on function public.update_schedule_shift(uuid, uuid, uuid, uuid, timestamp, timestamp, integer, text) to authenticated;
revoke all on function public.delete_schedule_shift(uuid) from public;
grant execute on function public.delete_schedule_shift(uuid) to authenticated;
revoke all on function public.assign_schedule_shift(uuid, uuid) from public;
grant execute on function public.assign_schedule_shift(uuid, uuid) to authenticated;
revoke all on function public.remove_schedule_shift_employee(uuid) from public;
grant execute on function public.remove_schedule_shift_employee(uuid) to authenticated;
revoke all on function public.publish_weekly_schedule(uuid) from public;
grant execute on function public.publish_weekly_schedule(uuid) to authenticated;
revoke all on function public.copy_schedule_shift(uuid, date) from public;
grant execute on function public.copy_schedule_shift(uuid, date) to authenticated;
revoke all on function public.copy_schedule_week(uuid, date) from public;
grant execute on function public.copy_schedule_week(uuid, date) to authenticated;

comment on table public.schedules is
  'Tenant-scoped weekly schedule. Employees can read only published schedules containing their own published shifts.';
comment on table public.shifts is
  'Scheduling write model. Mutations are centralized in scheduling RPCs; direct authenticated writes are revoked.';
