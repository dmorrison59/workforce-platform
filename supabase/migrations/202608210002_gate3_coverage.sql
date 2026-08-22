-- Gate 3: open-shift and shift-swap coverage workflows.

create type public.coverage_request_status as enum ('pending', 'approved', 'denied', 'cancelled');

create table public.open_shift_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shift_id uuid not null,
  employee_id uuid not null,
  status public.coverage_request_status not null default 'pending',
  shift_updated_at timestamptz not null,
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  manager_note text not null default '' check (char_length(manager_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (shift_id, organization_id)
    references public.shifts(id, organization_id) on delete cascade,
  foreign key (employee_id, organization_id)
    references public.employees(id, organization_id) on delete cascade,
  check (
    (status in ('pending', 'cancelled') and reviewed_by is null and reviewed_at is null)
    or (status in ('approved', 'denied') and reviewed_by is not null and reviewed_at is not null)
  )
);

create table public.shift_swap_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shift_id uuid not null,
  requesting_employee_id uuid not null,
  target_employee_id uuid,
  status public.coverage_request_status not null default 'pending',
  shift_updated_at timestamptz not null,
  requested_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  manager_note text not null default '' check (char_length(manager_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (shift_id, organization_id)
    references public.shifts(id, organization_id) on delete cascade,
  foreign key (requesting_employee_id, organization_id)
    references public.employees(id, organization_id) on delete cascade,
  foreign key (target_employee_id, organization_id)
    references public.employees(id, organization_id) on delete restrict,
  check (target_employee_id is null or target_employee_id <> requesting_employee_id),
  check (
    (status in ('pending', 'cancelled') and approved_by is null and approved_at is null)
    or (status in ('approved', 'denied') and approved_by is not null and approved_at is not null)
  )
);

create unique index open_shift_requests_one_pending_employee_idx
  on public.open_shift_requests(organization_id, shift_id, employee_id)
  where status = 'pending';
create index open_shift_requests_pending_idx
  on public.open_shift_requests(organization_id, shift_id, requested_at)
  where status = 'pending';
create unique index shift_swap_requests_one_pending_shift_idx
  on public.shift_swap_requests(organization_id, shift_id, requesting_employee_id)
  where status = 'pending';
create index shift_swap_requests_pending_idx
  on public.shift_swap_requests(organization_id, requested_at)
  where status = 'pending';

insert into public.permissions (capability, description) values
  ('open_shift.view', 'View eligible published open shifts'),
  ('open_shift.request', 'Request and cancel open shifts for the current employee profile'),
  ('open_shift.manage', 'Open shifts and review organization open-shift requests'),
  ('shift_swap.request', 'Request and cancel swaps for the current employee profile'),
  ('shift_swap.approve', 'Review and decide organization shift-swap requests');

insert into public.role_permissions (organization_id, role_id, permission_id)
select role.organization_id, role.id, permission.id
from public.roles role
join public.permissions permission on permission.capability in (
  'open_shift.view', 'open_shift.request', 'open_shift.manage',
  'shift_swap.request', 'shift_swap.approve'
)
where role.is_system and role.name in ('Owner', 'Manager')
on conflict do nothing;

insert into public.role_permissions (organization_id, role_id, permission_id)
select role.organization_id, role.id, permission.id
from public.roles role
join public.permissions permission on permission.capability in (
  'open_shift.view', 'open_shift.request', 'shift_swap.request'
)
where role.is_system and role.name = 'Employee'
on conflict do nothing;

update public.organization_modules
set enabled = true
where module_key in ('open_shifts', 'shift_swaps');

create or replace function public.grant_coverage_role_permissions()
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
      'open_shift.view', 'open_shift.request', 'open_shift.manage',
      'shift_swap.request', 'shift_swap.approve'
    )
    on conflict do nothing;
  elsif new.is_system and new.name = 'Employee' then
    insert into public.role_permissions (organization_id, role_id, permission_id)
    select new.organization_id, new.id, permission.id
    from public.permissions permission
    where permission.capability in (
      'open_shift.view', 'open_shift.request', 'shift_swap.request'
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger roles_grant_coverage_permissions
after insert on public.roles
for each row execute function public.grant_coverage_role_permissions();

create or replace function public.enable_coverage_modules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.module_key in ('open_shifts', 'shift_swaps') then
    new.enabled = true;
  end if;
  return new;
end;
$$;

create trigger modules_enable_coverage
before insert on public.organization_modules
for each row execute function public.enable_coverage_modules();

create trigger open_shift_requests_set_updated_at before update on public.open_shift_requests
for each row execute function public.set_updated_at();
create trigger shift_swap_requests_set_updated_at before update on public.shift_swap_requests
for each row execute function public.set_updated_at();
create trigger open_shift_requests_audit after insert or update or delete on public.open_shift_requests
for each row execute function public.capture_audit_event();
create trigger shift_swap_requests_audit after insert or update or delete on public.shift_swap_requests
for each row execute function public.capture_audit_event();

alter table public.open_shift_requests enable row level security;
alter table public.shift_swap_requests enable row level security;

create policy shifts_select_open_coverage on public.shifts for select to authenticated
using (
  status = 'open'
  and employee_id is null
  and public.has_permission(organization_id, 'open_shift.view')
  and public.current_employee_id(organization_id) is not null
  and public.schedule_is_published(schedule_id, organization_id)
);

create policy open_shift_requests_select_capability on public.open_shift_requests for select to authenticated
using (
  public.has_permission(organization_id, 'open_shift.manage')
  or (
    public.has_permission(organization_id, 'open_shift.request')
    and employee_id = public.current_employee_id(organization_id)
  )
);

create policy shift_swap_requests_select_capability on public.shift_swap_requests for select to authenticated
using (
  public.has_permission(organization_id, 'shift_swap.approve')
  or (
    public.has_permission(organization_id, 'shift_swap.request')
    and requesting_employee_id = public.current_employee_id(organization_id)
  )
);

-- Scheduling-owned operation: preserve a published schedule while removing the
-- assignment and exposing the shift to eligible employees.
create or replace function public.scheduling_mark_shift_open(target_shift_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_shift public.shifts%rowtype;
begin
  select shift.* into target_shift
  from public.shifts shift
  where shift.id = target_shift_id
  for update;
  if not found or not public.has_permission(target_shift.organization_id, 'open_shift.manage') then
    raise exception 'Open-shift management permission required' using errcode = '42501';
  end if;
  if target_shift.status <> 'published'
     or not public.schedule_is_published(target_shift.schedule_id, target_shift.organization_id) then
    raise exception 'Only a published shift on a published schedule can be marked open';
  end if;
  if target_shift.end_at <= now() then
    raise exception 'Past shifts cannot be marked open';
  end if;

  update public.open_shift_requests
  set status = 'cancelled'
  where shift_id = target_shift.id and status = 'pending';
  update public.shift_swap_requests
  set status = 'cancelled'
  where shift_id = target_shift.id and status = 'pending';
  update public.shifts
  set employee_id = null, status = 'open'
  where id = target_shift.id;
end;
$$;

create or replace function public.create_my_open_shift_request(
  target_organization_id uuid,
  target_shift_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_employee_id uuid;
  target_shift public.shifts%rowtype;
  request_id uuid;
begin
  if not public.has_permission(target_organization_id, 'open_shift.request') then
    raise exception 'Open-shift request permission required' using errcode = '42501';
  end if;
  target_employee_id := public.current_employee_id(target_organization_id);
  if target_employee_id is null then
    raise exception 'An active employee profile is required' using errcode = '42501';
  end if;
  select shift.* into target_shift
  from public.shifts shift
  where shift.id = target_shift_id and shift.organization_id = target_organization_id
  for update;
  if not found
     or target_shift.status <> 'open'
     or target_shift.employee_id is not null
     or target_shift.end_at <= now()
     or not public.schedule_is_published(target_shift.schedule_id, target_shift.organization_id) then
    raise exception 'Open shift is not available to request';
  end if;
  if exists (
    select 1 from public.open_shift_requests request
    where request.organization_id = target_organization_id
      and request.shift_id = target_shift.id
      and request.employee_id = target_employee_id
      and request.status = 'pending'
  ) then
    raise exception 'A pending request already exists for this shift';
  end if;

  insert into public.open_shift_requests (
    organization_id, shift_id, employee_id, shift_updated_at
  ) values (
    target_organization_id, target_shift.id, target_employee_id, target_shift.updated_at
  ) returning id into request_id;
  return request_id;
exception
  when unique_violation then
    raise exception 'A pending request already exists for this shift';
end;
$$;

create or replace function public.cancel_my_open_shift_request(target_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_request public.open_shift_requests%rowtype;
begin
  select request.* into target_request
  from public.open_shift_requests request
  where request.id = target_request_id
  for update;
  if not found
     or not public.has_permission(target_request.organization_id, 'open_shift.request')
     or target_request.employee_id <> public.current_employee_id(target_request.organization_id) then
    raise exception 'Open-shift request not found or not owned by the current employee' using errcode = '42501';
  end if;
  if target_request.status <> 'pending' then
    raise exception 'Only pending open-shift requests can be cancelled';
  end if;
  update public.open_shift_requests set status = 'cancelled'
  where id = target_request.id;
end;
$$;

-- Scheduling-owned approval operation. The row locks and expected updated_at
-- snapshot prevent stale or concurrent approvals; the existing shifts trigger
-- remains authoritative for active employee, tenant, and overlap validation.
create or replace function public.scheduling_approve_open_shift_request(
  target_request_id uuid,
  review_note text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_request public.open_shift_requests%rowtype;
  target_shift public.shifts%rowtype;
  reviewer_profile_id uuid;
begin
  select request.* into target_request
  from public.open_shift_requests request
  where request.id = target_request_id;
  if not found or not public.has_permission(target_request.organization_id, 'open_shift.manage') then
    raise exception 'Open-shift management permission required' using errcode = '42501';
  end if;

  -- Lock the shared shift before the individual request. Competing approvals for
  -- different requests then serialize on one lock instead of deadlocking while
  -- each transaction holds a different request row.
  select shift.* into target_shift
  from public.shifts shift
  where shift.id = target_request.shift_id
    and shift.organization_id = target_request.organization_id
  for update;
  select request.* into target_request
  from public.open_shift_requests request
  where request.id = target_request_id
  for update;
  if not found or target_request.status <> 'pending' then
    raise exception 'Only pending open-shift requests can be approved';
  end if;
  reviewer_profile_id := public.current_profile_id();
  if exists (
    select 1 from public.employees employee
    where employee.id = target_request.employee_id
      and employee.organization_id = target_request.organization_id
      and employee.profile_id = reviewer_profile_id
  ) then
    raise exception 'Employees cannot approve their own open-shift request' using errcode = '42501';
  end if;
  if target_shift.status <> 'open'
     or target_shift.employee_id is not null
     or target_shift.updated_at <> target_request.shift_updated_at
     or not public.schedule_is_published(target_shift.schedule_id, target_shift.organization_id) then
    raise exception 'Open shift changed after the request was submitted';
  end if;

  update public.shifts
  set employee_id = target_request.employee_id, status = 'published'
  where id = target_shift.id;
  update public.open_shift_requests
  set status = 'approved', reviewed_by = reviewer_profile_id,
      reviewed_at = now(), manager_note = trim(coalesce(review_note, ''))
  where id = target_request.id;
  update public.open_shift_requests
  set status = 'denied', reviewed_by = reviewer_profile_id,
      reviewed_at = now(), manager_note = 'Another request was approved.'
  where shift_id = target_shift.id and id <> target_request.id and status = 'pending';
end;
$$;

create or replace function public.review_open_shift_request(
  target_request_id uuid,
  review_status public.coverage_request_status,
  review_note text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_request public.open_shift_requests%rowtype;
  reviewer_profile_id uuid;
begin
  if review_status <> 'denied' then
    raise exception 'Coverage denial operation accepts only denied status';
  end if;
  select request.* into target_request
  from public.open_shift_requests request
  where request.id = target_request_id
  for update;
  if not found or not public.has_permission(target_request.organization_id, 'open_shift.manage') then
    raise exception 'Open-shift management permission required' using errcode = '42501';
  end if;
  if target_request.status <> 'pending' then
    raise exception 'Only pending open-shift requests can be reviewed';
  end if;
  reviewer_profile_id := public.current_profile_id();
  if exists (
    select 1 from public.employees employee
    where employee.id = target_request.employee_id
      and employee.organization_id = target_request.organization_id
      and employee.profile_id = reviewer_profile_id
  ) then
    raise exception 'Employees cannot approve or deny their own open-shift request' using errcode = '42501';
  end if;
  update public.open_shift_requests
  set status = 'denied', reviewed_by = reviewer_profile_id,
      reviewed_at = now(), manager_note = trim(coalesce(review_note, ''))
  where id = target_request.id;
end;
$$;

create or replace function public.create_my_shift_swap_request(
  target_organization_id uuid,
  target_shift_id uuid,
  requested_target_employee_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_requesting_employee_id uuid;
  target_shift public.shifts%rowtype;
  request_id uuid;
begin
  if not public.has_permission(target_organization_id, 'shift_swap.request') then
    raise exception 'Shift-swap request permission required' using errcode = '42501';
  end if;
  current_requesting_employee_id := public.current_employee_id(target_organization_id);
  if current_requesting_employee_id is null then
    raise exception 'An active employee profile is required' using errcode = '42501';
  end if;
  select shift.* into target_shift
  from public.shifts shift
  where shift.id = target_shift_id and shift.organization_id = target_organization_id
  for update;
  if not found
     or target_shift.status <> 'published'
     or target_shift.employee_id <> current_requesting_employee_id
     or target_shift.end_at <= now()
     or not public.schedule_is_published(target_shift.schedule_id, target_shift.organization_id) then
    raise exception 'Only your own upcoming published shift can be swapped';
  end if;
  if requested_target_employee_id is not null and (
    requested_target_employee_id = current_requesting_employee_id
    or not exists (
      select 1 from public.employees employee
      where employee.id = requested_target_employee_id
        and employee.organization_id = target_organization_id
        and employee.employment_status = 'active'
    )
  ) then
    raise exception 'Swap target must be another active employee in the organization';
  end if;
  if exists (
    select 1 from public.shift_swap_requests request
    where request.organization_id = target_organization_id
      and request.shift_id = target_shift.id
      and request.requesting_employee_id = current_requesting_employee_id
      and request.status = 'pending'
  ) then
    raise exception 'A pending swap request already exists for this shift';
  end if;

  insert into public.shift_swap_requests (
    organization_id, shift_id, requesting_employee_id, target_employee_id, shift_updated_at
  ) values (
    target_organization_id, target_shift.id, current_requesting_employee_id,
    requested_target_employee_id, target_shift.updated_at
  ) returning id into request_id;
  return request_id;
exception
  when unique_violation then
    raise exception 'A pending swap request already exists for this shift';
end;
$$;

create or replace function public.cancel_my_shift_swap_request(target_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_request public.shift_swap_requests%rowtype;
begin
  select request.* into target_request
  from public.shift_swap_requests request
  where request.id = target_request_id
  for update;
  if not found
     or not public.has_permission(target_request.organization_id, 'shift_swap.request')
     or target_request.requesting_employee_id <> public.current_employee_id(target_request.organization_id) then
    raise exception 'Swap request not found or not owned by the current employee' using errcode = '42501';
  end if;
  if target_request.status <> 'pending' then
    raise exception 'Only pending swap requests can be cancelled';
  end if;
  update public.shift_swap_requests set status = 'cancelled'
  where id = target_request.id;
end;
$$;

-- Scheduling-owned approval operation. It reassigns a still-current published
-- shift and relies on the existing shifts trigger for assignment integrity.
create or replace function public.scheduling_approve_shift_swap(
  target_request_id uuid,
  review_note text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_request public.shift_swap_requests%rowtype;
  target_shift public.shifts%rowtype;
  reviewer_profile_id uuid;
begin
  select request.* into target_request
  from public.shift_swap_requests request
  where request.id = target_request_id
  for update;
  if not found or not public.has_permission(target_request.organization_id, 'shift_swap.approve') then
    raise exception 'Shift-swap approval permission required' using errcode = '42501';
  end if;
  if target_request.status <> 'pending' then
    raise exception 'Only pending swap requests can be approved';
  end if;
  if target_request.target_employee_id is null then
    raise exception 'A target employee is required before a swap can be approved';
  end if;
  reviewer_profile_id := public.current_profile_id();
  if exists (
    select 1 from public.employees employee
    where employee.id = target_request.requesting_employee_id
      and employee.organization_id = target_request.organization_id
      and employee.profile_id = reviewer_profile_id
  ) then
    raise exception 'Employees cannot approve their own shift-swap request' using errcode = '42501';
  end if;

  select shift.* into target_shift
  from public.shifts shift
  where shift.id = target_request.shift_id
    and shift.organization_id = target_request.organization_id
  for update;
  if not found
     or target_shift.status <> 'published'
     or target_shift.employee_id <> target_request.requesting_employee_id
     or target_shift.updated_at <> target_request.shift_updated_at
     or not public.schedule_is_published(target_shift.schedule_id, target_shift.organization_id) then
    raise exception 'Assigned shift changed after the swap was requested';
  end if;

  update public.shifts
  set employee_id = target_request.target_employee_id, status = 'published'
  where id = target_shift.id;
  update public.shift_swap_requests
  set status = 'approved', approved_by = reviewer_profile_id,
      approved_at = now(), manager_note = trim(coalesce(review_note, ''))
  where id = target_request.id;
end;
$$;

create or replace function public.review_shift_swap_request(
  target_request_id uuid,
  review_status public.coverage_request_status,
  review_note text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_request public.shift_swap_requests%rowtype;
  reviewer_profile_id uuid;
begin
  if review_status <> 'denied' then
    raise exception 'Coverage denial operation accepts only denied status';
  end if;
  select request.* into target_request
  from public.shift_swap_requests request
  where request.id = target_request_id
  for update;
  if not found or not public.has_permission(target_request.organization_id, 'shift_swap.approve') then
    raise exception 'Shift-swap approval permission required' using errcode = '42501';
  end if;
  if target_request.status <> 'pending' then
    raise exception 'Only pending swap requests can be reviewed';
  end if;
  reviewer_profile_id := public.current_profile_id();
  if exists (
    select 1 from public.employees employee
    where employee.id = target_request.requesting_employee_id
      and employee.organization_id = target_request.organization_id
      and employee.profile_id = reviewer_profile_id
  ) then
    raise exception 'Employees cannot approve or deny their own shift-swap request' using errcode = '42501';
  end if;
  update public.shift_swap_requests
  set status = 'denied', approved_by = reviewer_profile_id,
      approved_at = now(), manager_note = trim(coalesce(review_note, ''))
  where id = target_request.id;
end;
$$;

-- Republishing a draft schedule must not silently close an already-open shift.
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
  where schedule_id = target_schedule.id and status = 'draft';
  update public.schedules set
    status = 'published', published_at = now(), published_by = public.current_profile_id()
  where id = target_schedule.id;
end;
$$;

revoke all on public.open_shift_requests, public.shift_swap_requests from anon;
revoke all on public.open_shift_requests, public.shift_swap_requests from authenticated;
grant select on public.open_shift_requests, public.shift_swap_requests to authenticated;

revoke all on function public.scheduling_mark_shift_open(uuid) from public;
grant execute on function public.scheduling_mark_shift_open(uuid) to authenticated;
revoke all on function public.create_my_open_shift_request(uuid, uuid) from public;
grant execute on function public.create_my_open_shift_request(uuid, uuid) to authenticated;
revoke all on function public.cancel_my_open_shift_request(uuid) from public;
grant execute on function public.cancel_my_open_shift_request(uuid) to authenticated;
revoke all on function public.scheduling_approve_open_shift_request(uuid, text) from public;
grant execute on function public.scheduling_approve_open_shift_request(uuid, text) to authenticated;
revoke all on function public.review_open_shift_request(uuid, public.coverage_request_status, text) from public;
grant execute on function public.review_open_shift_request(uuid, public.coverage_request_status, text) to authenticated;
revoke all on function public.create_my_shift_swap_request(uuid, uuid, uuid) from public;
grant execute on function public.create_my_shift_swap_request(uuid, uuid, uuid) to authenticated;
revoke all on function public.cancel_my_shift_swap_request(uuid) from public;
grant execute on function public.cancel_my_shift_swap_request(uuid) to authenticated;
revoke all on function public.scheduling_approve_shift_swap(uuid, text) from public;
grant execute on function public.scheduling_approve_shift_swap(uuid, text) to authenticated;
revoke all on function public.review_shift_swap_request(uuid, public.coverage_request_status, text) from public;
grant execute on function public.review_shift_swap_request(uuid, public.coverage_request_status, text) to authenticated;

comment on table public.open_shift_requests is
  'Employee requests for published open shifts. Coverage owns request state; Scheduling owns assignment approval.';
comment on table public.shift_swap_requests is
  'Employee requests to reassign their published shifts. Coverage owns request state; Scheduling owns approved reassignment.';
