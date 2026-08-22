-- Gate 4: actual worked time, breaks, review, and auditable corrections.

create type public.time_entry_status as enum ('open', 'completed', 'corrected', 'cancelled');
create type public.time_entry_source as enum ('employee', 'manager', 'system');
create type public.timesheet_review_status as enum ('unreviewed', 'approved');

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null,
  shift_id uuid,
  location_id uuid not null,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  status public.time_entry_status not null default 'open',
  source public.time_entry_source not null default 'employee',
  review_status public.timesheet_review_status not null default 'unreviewed',
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  corrected_by uuid references public.profiles(id) on delete set null,
  corrected_at timestamptz,
  correction_note text not null default '' check (char_length(correction_note) <= 2000),
  original_clock_in_at timestamptz,
  original_clock_out_at timestamptz,
  original_location_id uuid,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (employee_id, organization_id)
    references public.employees(id, organization_id) on delete restrict,
  foreign key (shift_id, organization_id)
    references public.shifts(id, organization_id) on delete set null (shift_id),
  foreign key (location_id, organization_id)
    references public.locations(id, organization_id) on delete restrict,
  foreign key (original_location_id, organization_id)
    references public.locations(id, organization_id) on delete restrict,
  check (clock_out_at is null or clock_out_at > clock_in_at),
  check (
    (status = 'open' and clock_out_at is null)
    or (status in ('completed', 'corrected') and clock_out_at is not null)
    or status = 'cancelled'
  ),
  check (
    (review_status = 'unreviewed' and approved_by is null and approved_at is null)
    or (
      review_status = 'approved' and status in ('completed', 'corrected')
      and approved_by is not null and approved_at is not null
    )
  ),
  check (
    (status <> 'corrected' and corrected_by is null and corrected_at is null
      and correction_note = '' and original_clock_in_at is null
      and original_clock_out_at is null and original_location_id is null)
    or (
      status = 'corrected' and corrected_by is not null and corrected_at is not null
      and char_length(trim(correction_note)) > 0 and original_clock_in_at is not null
      and original_location_id is not null
    )
  )
);

create table public.time_breaks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  time_entry_id uuid not null,
  start_at timestamptz not null,
  end_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (time_entry_id, organization_id)
    references public.time_entries(id, organization_id) on delete cascade,
  check (end_at is null or end_at > start_at)
);

create unique index time_entries_one_open_employee_idx
  on public.time_entries(organization_id, employee_id)
  where status = 'open';
create index time_entries_employee_clock_idx
  on public.time_entries(organization_id, employee_id, clock_in_at desc);
create index time_entries_review_idx
  on public.time_entries(organization_id, review_status, clock_in_at desc)
  where status in ('completed', 'corrected');
create unique index time_breaks_one_open_entry_idx
  on public.time_breaks(organization_id, time_entry_id)
  where end_at is null;
create index time_breaks_entry_start_idx
  on public.time_breaks(organization_id, time_entry_id, start_at);

insert into public.permissions (capability, description) values
  ('timeclock.use', 'Clock the current employee profile in and out and manage breaks'),
  ('timeclock.view_self', 'View the current employee profile time entries and breaks'),
  ('timeclock.view', 'View organization time entries and breaks'),
  ('timeclock.edit', 'Correct and approve organization time entries');

insert into public.role_permissions (organization_id, role_id, permission_id)
select role.organization_id, role.id, permission.id
from public.roles role
join public.permissions permission on permission.capability in (
  'timeclock.use', 'timeclock.view_self', 'timeclock.view', 'timeclock.edit'
)
where role.is_system and role.name in ('Owner', 'Manager')
on conflict do nothing;

insert into public.role_permissions (organization_id, role_id, permission_id)
select role.organization_id, role.id, permission.id
from public.roles role
join public.permissions permission on permission.capability in (
  'timeclock.use', 'timeclock.view_self'
)
where role.is_system and role.name = 'Employee'
on conflict do nothing;

update public.organization_modules set enabled = true where module_key = 'time_clock';

create or replace function public.grant_time_clock_role_permissions()
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
    where permission.capability in (
      'timeclock.use', 'timeclock.view_self', 'timeclock.view', 'timeclock.edit'
    )
    on conflict do nothing;
  elsif new.is_system and new.name = 'Employee' then
    insert into public.role_permissions (organization_id, role_id, permission_id)
    select new.organization_id, new.id, permission.id
    from public.permissions permission
    where permission.capability in ('timeclock.use', 'timeclock.view_self')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger roles_grant_time_clock_permissions
after insert on public.roles
for each row execute function public.grant_time_clock_role_permissions();

create or replace function public.enable_time_clock_module()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.module_key = 'time_clock' then new.enabled = true; end if;
  return new;
end;
$$;

create trigger modules_enable_time_clock
before insert on public.organization_modules
for each row execute function public.enable_time_clock_module();

create or replace function public.validate_time_entry_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.employee_id is distinct from old.employee_id then
    if not exists (
      select 1 from public.employees employee
      where employee.id = new.employee_id
        and employee.organization_id = new.organization_id
        and employee.employment_status = 'active'
    ) then
      raise exception 'Employee must be active and belong to the time-entry organization';
    end if;
  end if;
  if tg_op = 'INSERT' or new.location_id is distinct from old.location_id then
    if not exists (
      select 1 from public.locations location
      where location.id = new.location_id
        and location.organization_id = new.organization_id
        and location.active
    ) then
      raise exception 'Location must be active and belong to the time-entry organization';
    end if;
  end if;
  if new.shift_id is not null and (
    tg_op = 'INSERT' or new.shift_id is distinct from old.shift_id
    or new.employee_id is distinct from old.employee_id
    or new.location_id is distinct from old.location_id
  ) and not exists (
    select 1 from public.shifts shift
    where shift.id = new.shift_id
      and shift.organization_id = new.organization_id
      and shift.employee_id = new.employee_id
      and shift.location_id = new.location_id
      and (
        tg_op = 'UPDATE'
        or (
          shift.status = 'published'
          and public.schedule_is_published(shift.schedule_id, shift.organization_id)
        )
      )
  ) then
    raise exception 'Linked shift must be an assigned published shift for the same employee, organization, and location';
  end if;
  if new.status <> 'cancelled' and exists (
    select 1 from public.time_entries existing
    where existing.organization_id = new.organization_id
      and existing.employee_id = new.employee_id
      and existing.id <> new.id
      and existing.status <> 'cancelled'
      and tstzrange(existing.clock_in_at, coalesce(existing.clock_out_at, 'infinity'::timestamptz), '[)')
          && tstzrange(new.clock_in_at, coalesce(new.clock_out_at, 'infinity'::timestamptz), '[)')
  ) then
    raise exception 'Employee already has an overlapping time entry';
  end if;
  if new.status in ('completed', 'corrected') and exists (
    select 1 from public.time_breaks break_record
    where break_record.time_entry_id = new.id
      and (
        break_record.end_at is null
        or break_record.start_at < new.clock_in_at
        or break_record.end_at > new.clock_out_at
      )
  ) then
    raise exception 'Completed time entries require closed breaks inside the corrected time range';
  end if;
  return new;
end;
$$;

create or replace function public.validate_time_break_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_entry public.time_entries%rowtype;
begin
  select entry.* into parent_entry
  from public.time_entries entry
  where entry.id = new.time_entry_id
    and entry.organization_id = new.organization_id;
  if not found then
    raise exception 'Break must belong to a time entry in the same organization';
  end if;
  if new.start_at < parent_entry.clock_in_at
     or (parent_entry.clock_out_at is not null and (
       new.start_at >= parent_entry.clock_out_at
       or (new.end_at is not null and new.end_at > parent_entry.clock_out_at)
     )) then
    raise exception 'Break must fall inside its parent time entry';
  end if;
  if exists (
    select 1 from public.time_breaks existing
    where existing.time_entry_id = new.time_entry_id
      and existing.id <> new.id
      and tstzrange(existing.start_at, coalesce(existing.end_at, 'infinity'::timestamptz), '[)')
          && tstzrange(new.start_at, coalesce(new.end_at, 'infinity'::timestamptz), '[)')
  ) then
    raise exception 'Breaks for a time entry cannot overlap';
  end if;
  return new;
end;
$$;

create trigger time_entries_set_updated_at before update on public.time_entries
for each row execute function public.set_updated_at();
create trigger time_breaks_set_updated_at before update on public.time_breaks
for each row execute function public.set_updated_at();
create trigger time_entries_validate before insert or update on public.time_entries
for each row execute function public.validate_time_entry_integrity();
create trigger time_breaks_validate before insert or update on public.time_breaks
for each row execute function public.validate_time_break_integrity();
create trigger time_entries_audit after insert or update or delete on public.time_entries
for each row execute function public.capture_audit_event();
create trigger time_breaks_audit after insert or update or delete on public.time_breaks
for each row execute function public.capture_audit_event();

alter table public.time_entries enable row level security;
alter table public.time_breaks enable row level security;

create or replace function public.can_view_time_entry(
  target_entry_id uuid,
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.time_entries entry
    where entry.id = target_entry_id
      and entry.organization_id = target_organization_id
      and (
        public.has_permission(target_organization_id, 'timeclock.view')
        or (
          public.has_permission(target_organization_id, 'timeclock.view_self')
          and entry.employee_id = public.current_employee_id(target_organization_id)
        )
      )
  );
$$;

create policy time_entries_select_capability on public.time_entries for select to authenticated
using (
  public.has_permission(organization_id, 'timeclock.view')
  or (
    public.has_permission(organization_id, 'timeclock.view_self')
    and employee_id = public.current_employee_id(organization_id)
  )
);
create policy time_breaks_select_capability on public.time_breaks for select to authenticated
using (public.can_view_time_entry(time_entry_id, organization_id));

create or replace function public.clock_in(
  target_organization_id uuid,
  target_location_id uuid,
  target_shift_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_employee_id uuid;
  entry_id uuid;
  event_at timestamptz := clock_timestamp();
begin
  if not public.has_permission(target_organization_id, 'timeclock.use') then
    raise exception 'Time-clock use permission required' using errcode = '42501';
  end if;
  target_employee_id := public.current_employee_id(target_organization_id);
  if target_employee_id is null then
    raise exception 'An active employee profile is required' using errcode = '42501';
  end if;
  perform 1 from public.employees employee
  where employee.id = target_employee_id and employee.organization_id = target_organization_id
  for update;
  if exists (
    select 1 from public.time_entries entry
    where entry.organization_id = target_organization_id
      and entry.employee_id = target_employee_id
      and entry.status = 'open'
  ) then
    raise exception 'Employee already has an open time entry';
  end if;
  insert into public.time_entries (
    organization_id, employee_id, shift_id, location_id,
    clock_in_at, status, source, created_by
  ) values (
    target_organization_id, target_employee_id, target_shift_id, target_location_id,
    event_at, 'open', 'employee', public.current_profile_id()
  ) returning id into entry_id;
  return entry_id;
exception
  when unique_violation then
    raise exception 'Employee already has an open time entry';
end;
$$;

create or replace function public.clock_out(target_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_employee_id uuid;
  target_entry public.time_entries%rowtype;
  event_at timestamptz := clock_timestamp();
begin
  if not public.has_permission(target_organization_id, 'timeclock.use') then
    raise exception 'Time-clock use permission required' using errcode = '42501';
  end if;
  target_employee_id := public.current_employee_id(target_organization_id);
  select entry.* into target_entry
  from public.time_entries entry
  where entry.organization_id = target_organization_id
    and entry.employee_id = target_employee_id
    and entry.status = 'open'
  for update;
  if not found then raise exception 'No open time entry exists to clock out'; end if;
  if exists (
    select 1 from public.time_breaks break_record
    where break_record.time_entry_id = target_entry.id and break_record.end_at is null
  ) then
    raise exception 'End the active break before clocking out';
  end if;
  update public.time_entries
  set clock_out_at = event_at, status = 'completed'
  where id = target_entry.id;
end;
$$;

create or replace function public.start_break(target_organization_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_employee_id uuid;
  target_entry public.time_entries%rowtype;
  break_id uuid;
  event_at timestamptz := clock_timestamp();
begin
  if not public.has_permission(target_organization_id, 'timeclock.use') then
    raise exception 'Time-clock use permission required' using errcode = '42501';
  end if;
  target_employee_id := public.current_employee_id(target_organization_id);
  select entry.* into target_entry
  from public.time_entries entry
  where entry.organization_id = target_organization_id
    and entry.employee_id = target_employee_id
    and entry.status = 'open'
  for update;
  if not found then raise exception 'Clock in before starting a break'; end if;
  if exists (
    select 1 from public.time_breaks break_record
    where break_record.time_entry_id = target_entry.id and break_record.end_at is null
  ) then
    raise exception 'A break is already active';
  end if;
  insert into public.time_breaks (organization_id, time_entry_id, start_at)
  values (target_organization_id, target_entry.id, event_at)
  returning id into break_id;
  return break_id;
exception
  when unique_violation then raise exception 'A break is already active';
end;
$$;

create or replace function public.end_break(target_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_employee_id uuid;
  target_entry public.time_entries%rowtype;
  target_break public.time_breaks%rowtype;
  event_at timestamptz := clock_timestamp();
begin
  if not public.has_permission(target_organization_id, 'timeclock.use') then
    raise exception 'Time-clock use permission required' using errcode = '42501';
  end if;
  target_employee_id := public.current_employee_id(target_organization_id);
  select entry.* into target_entry
  from public.time_entries entry
  where entry.organization_id = target_organization_id
    and entry.employee_id = target_employee_id
    and entry.status = 'open'
  for update;
  if not found then raise exception 'No open time entry exists'; end if;
  select break_record.* into target_break
  from public.time_breaks break_record
  where break_record.time_entry_id = target_entry.id and break_record.end_at is null
  for update;
  if not found then raise exception 'No active break exists to end'; end if;
  update public.time_breaks set end_at = event_at where id = target_break.id;
end;
$$;

create or replace function public.correct_time_entry(
  target_entry_id uuid,
  corrected_location_id uuid,
  corrected_clock_in_local timestamp without time zone,
  corrected_clock_out_local timestamp without time zone,
  correction_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_entry public.time_entries%rowtype;
  organization_timezone text;
  resolved_clock_in timestamptz;
  resolved_clock_out timestamptz;
begin
  select entry.* into target_entry
  from public.time_entries entry where entry.id = target_entry_id
  for update;
  if not found or not public.has_permission(target_entry.organization_id, 'timeclock.edit') then
    raise exception 'Time-entry correction permission required' using errcode = '42501';
  end if;
  if target_entry.status = 'cancelled' then
    raise exception 'Cancelled time entries cannot be corrected';
  end if;
  if char_length(trim(coalesce(correction_reason, ''))) = 0 then
    raise exception 'A correction reason is required';
  end if;
  if exists (
    select 1 from public.time_breaks break_record
    where break_record.time_entry_id = target_entry.id and break_record.end_at is null
  ) then
    raise exception 'End the active break before correcting this entry';
  end if;
  select timezone into organization_timezone
  from public.organizations where id = target_entry.organization_id;
  resolved_clock_in := corrected_clock_in_local at time zone organization_timezone;
  resolved_clock_out := corrected_clock_out_local at time zone organization_timezone;
  if resolved_clock_out <= resolved_clock_in then
    raise exception 'Corrected clock-out must be after clock-in';
  end if;
  update public.time_entries set
    location_id = corrected_location_id,
    clock_in_at = resolved_clock_in,
    clock_out_at = resolved_clock_out,
    status = 'corrected',
    source = 'manager',
    review_status = 'unreviewed',
    approved_by = null,
    approved_at = null,
    corrected_by = public.current_profile_id(),
    corrected_at = clock_timestamp(),
    correction_note = trim(correction_reason),
    original_clock_in_at = coalesce(original_clock_in_at, target_entry.clock_in_at),
    original_clock_out_at = case
      when original_clock_in_at is null then target_entry.clock_out_at
      else original_clock_out_at
    end,
    original_location_id = coalesce(original_location_id, target_entry.location_id)
  where id = target_entry.id;
end;
$$;

create or replace function public.approve_time_entry(target_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_entry public.time_entries%rowtype;
begin
  select entry.* into target_entry
  from public.time_entries entry where entry.id = target_entry_id
  for update;
  if not found or not public.has_permission(target_entry.organization_id, 'timeclock.edit') then
    raise exception 'Time-entry approval permission required' using errcode = '42501';
  end if;
  if target_entry.status not in ('completed', 'corrected') then
    raise exception 'Only completed or corrected entries can be approved';
  end if;
  update public.time_entries set
    review_status = 'approved', approved_by = public.current_profile_id(),
    approved_at = clock_timestamp()
  where id = target_entry.id;
end;
$$;

revoke all on public.time_entries, public.time_breaks from anon;
revoke all on public.time_entries, public.time_breaks from authenticated;
grant select on public.time_entries, public.time_breaks to authenticated;

revoke all on function public.can_view_time_entry(uuid, uuid) from public;
grant execute on function public.can_view_time_entry(uuid, uuid) to authenticated;
revoke all on function public.clock_in(uuid, uuid, uuid) from public;
grant execute on function public.clock_in(uuid, uuid, uuid) to authenticated;
revoke all on function public.clock_out(uuid) from public;
grant execute on function public.clock_out(uuid) to authenticated;
revoke all on function public.start_break(uuid) from public;
grant execute on function public.start_break(uuid) to authenticated;
revoke all on function public.end_break(uuid) from public;
grant execute on function public.end_break(uuid) to authenticated;
revoke all on function public.correct_time_entry(uuid, uuid, timestamp, timestamp, text) from public;
grant execute on function public.correct_time_entry(uuid, uuid, timestamp, timestamp, text) to authenticated;
revoke all on function public.approve_time_entry(uuid) from public;
grant execute on function public.approve_time_entry(uuid) to authenticated;

comment on table public.time_entries is
  'Actual worked-time records. Scheduled shifts remain unchanged and are linked read-only through nullable shift_id.';
comment on table public.time_breaks is
  'Actual break intervals contained by a tenant-scoped time entry.';
