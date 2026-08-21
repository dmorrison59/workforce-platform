-- Gate 2: employee availability, time off, and scheduling conflict inputs.

create type public.time_off_request_status as enum ('pending', 'approved', 'denied', 'cancelled');

create table public.employee_availability (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  available boolean not null default true,
  start_time time,
  end_time time,
  effective_from date not null,
  effective_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, employee_id, day_of_week, effective_from),
  unique (id, organization_id),
  foreign key (employee_id, organization_id)
    references public.employees(id, organization_id) on delete cascade,
  check (effective_until is null or effective_until >= effective_from),
  check (
    (not available and start_time is null and end_time is null)
    or (available and start_time is not null and end_time is not null and end_time > start_time)
  )
);

create table public.time_off_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null,
  start_date date not null,
  end_date date not null,
  reason text not null default '' check (char_length(reason) <= 2000),
  status public.time_off_request_status not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  manager_note text not null default '' check (char_length(manager_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (employee_id, organization_id)
    references public.employees(id, organization_id) on delete cascade,
  check (end_date >= start_date),
  check (
    (status in ('pending', 'cancelled') and reviewed_by is null and reviewed_at is null)
    or (status in ('approved', 'denied') and reviewed_by is not null and reviewed_at is not null)
  )
);

create index availability_employee_effective_idx
  on public.employee_availability(organization_id, employee_id, day_of_week, effective_from desc);
create index time_off_employee_dates_idx
  on public.time_off_requests(organization_id, employee_id, start_date, end_date);
create index time_off_pending_idx
  on public.time_off_requests(organization_id, requested_at)
  where status = 'pending';

insert into public.permissions (capability, description) values
  ('availability.view', 'View employee availability for scheduling'),
  ('availability.manage_self', 'Manage the current employee profile availability'),
  ('timeoff.request', 'Submit and cancel the current employee profile time-off requests'),
  ('timeoff.view_self', 'View the current employee profile time-off history'),
  ('timeoff.approve', 'Review and decide organization time-off requests');

insert into public.role_permissions (organization_id, role_id, permission_id)
select role.organization_id, role.id, permission.id
from public.roles role
join public.permissions permission on permission.capability in (
  'availability.view', 'availability.manage_self', 'timeoff.request',
  'timeoff.view_self', 'timeoff.approve'
)
where role.is_system and role.name in ('Owner', 'Manager')
on conflict do nothing;

insert into public.role_permissions (organization_id, role_id, permission_id)
select role.organization_id, role.id, permission.id
from public.roles role
join public.permissions permission on permission.capability in (
  'availability.manage_self', 'timeoff.request', 'timeoff.view_self'
)
where role.is_system and role.name = 'Employee'
on conflict do nothing;

update public.organization_modules
set enabled = true
where module_key in ('availability', 'time_off');

create or replace function public.grant_self_service_role_permissions()
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
      'availability.view', 'availability.manage_self', 'timeoff.request',
      'timeoff.view_self', 'timeoff.approve'
    )
    on conflict do nothing;
  elsif new.is_system and new.name = 'Employee' then
    insert into public.role_permissions (organization_id, role_id, permission_id)
    select new.organization_id, new.id, permission.id
    from public.permissions permission
    where permission.capability in (
      'availability.manage_self', 'timeoff.request', 'timeoff.view_self'
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger roles_grant_self_service_permissions
after insert on public.roles
for each row execute function public.grant_self_service_role_permissions();

create or replace function public.enable_self_service_modules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.module_key in ('availability', 'time_off') then
    new.enabled = true;
  end if;
  return new;
end;
$$;

create trigger modules_enable_self_service
before insert on public.organization_modules
for each row execute function public.enable_self_service_modules();

create trigger availability_set_updated_at before update on public.employee_availability
for each row execute function public.set_updated_at();
create trigger time_off_set_updated_at before update on public.time_off_requests
for each row execute function public.set_updated_at();
create trigger availability_audit after insert or update or delete on public.employee_availability
for each row execute function public.capture_audit_event();
create trigger time_off_audit after insert or update or delete on public.time_off_requests
for each row execute function public.capture_audit_event();

alter table public.employee_availability enable row level security;
alter table public.time_off_requests enable row level security;

create policy availability_select_capability on public.employee_availability for select to authenticated
using (
  public.has_permission(organization_id, 'availability.view')
  or (
    public.has_permission(organization_id, 'availability.manage_self')
    and employee_id = public.current_employee_id(organization_id)
  )
);
create policy availability_insert_self on public.employee_availability for insert to authenticated
with check (
  public.has_permission(organization_id, 'availability.manage_self')
  and employee_id = public.current_employee_id(organization_id)
);
create policy availability_update_self on public.employee_availability for update to authenticated
using (
  public.has_permission(organization_id, 'availability.manage_self')
  and employee_id = public.current_employee_id(organization_id)
)
with check (
  public.has_permission(organization_id, 'availability.manage_self')
  and employee_id = public.current_employee_id(organization_id)
);
create policy availability_delete_self on public.employee_availability for delete to authenticated
using (
  public.has_permission(organization_id, 'availability.manage_self')
  and employee_id = public.current_employee_id(organization_id)
);

create policy time_off_select_capability on public.time_off_requests for select to authenticated
using (
  public.has_permission(organization_id, 'timeoff.approve')
  or (
    public.has_permission(organization_id, 'timeoff.view_self')
    and employee_id = public.current_employee_id(organization_id)
  )
);
create policy time_off_insert_self on public.time_off_requests for insert to authenticated
with check (
  public.has_permission(organization_id, 'timeoff.request')
  and employee_id = public.current_employee_id(organization_id)
  and status = 'pending'
);
create policy time_off_update_self_or_approve on public.time_off_requests for update to authenticated
using (
  public.has_permission(organization_id, 'timeoff.approve')
  or (
    public.has_permission(organization_id, 'timeoff.request')
    and employee_id = public.current_employee_id(organization_id)
    and status = 'pending'
  )
)
with check (
  public.has_permission(organization_id, 'timeoff.approve')
  or (
    public.has_permission(organization_id, 'timeoff.request')
    and employee_id = public.current_employee_id(organization_id)
    and status = 'cancelled'
  )
);

create or replace function public.save_my_availability(
  target_organization_id uuid,
  availability_day_of_week smallint,
  availability_available boolean,
  availability_start_time time,
  availability_end_time time,
  availability_effective_from date,
  availability_effective_until date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_employee_id uuid;
  availability_id uuid;
begin
  if not public.has_permission(target_organization_id, 'availability.manage_self') then
    raise exception 'Self-service availability permission required' using errcode = '42501';
  end if;
  target_employee_id := public.current_employee_id(target_organization_id);
  if target_employee_id is null then
    raise exception 'An active employee profile is required' using errcode = '42501';
  end if;
  if availability_day_of_week not between 1 and 7 then
    raise exception 'Availability day must be between 1 and 7';
  end if;
  if availability_effective_until is not null
     and availability_effective_until < availability_effective_from then
    raise exception 'Availability effective end must not precede its start';
  end if;
  if availability_available and (
    availability_start_time is null or availability_end_time is null
    or availability_end_time <= availability_start_time
  ) then
    raise exception 'Available days require a valid start and end time';
  end if;

  insert into public.employee_availability (
    organization_id, employee_id, day_of_week, available, start_time, end_time,
    effective_from, effective_until
  ) values (
    target_organization_id, target_employee_id, availability_day_of_week,
    availability_available,
    case when availability_available then availability_start_time end,
    case when availability_available then availability_end_time end,
    availability_effective_from, availability_effective_until
  )
  on conflict (organization_id, employee_id, day_of_week, effective_from)
  do update set
    available = excluded.available,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    effective_until = excluded.effective_until
  returning id into availability_id;
  return availability_id;
end;
$$;

create or replace function public.delete_my_availability(target_availability_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_record public.employee_availability%rowtype;
begin
  select availability.* into target_record
  from public.employee_availability availability
  where availability.id = target_availability_id;
  if not found
     or not public.has_permission(target_record.organization_id, 'availability.manage_self')
     or target_record.employee_id <> public.current_employee_id(target_record.organization_id) then
    raise exception 'Availability record not found or not owned by the current employee' using errcode = '42501';
  end if;
  delete from public.employee_availability where id = target_record.id;
end;
$$;

create or replace function public.create_my_time_off_request(
  target_organization_id uuid,
  request_start_date date,
  request_end_date date,
  request_reason text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_employee_id uuid;
  request_id uuid;
begin
  if not public.has_permission(target_organization_id, 'timeoff.request') then
    raise exception 'Time-off request permission required' using errcode = '42501';
  end if;
  target_employee_id := public.current_employee_id(target_organization_id);
  if target_employee_id is null then
    raise exception 'An active employee profile is required' using errcode = '42501';
  end if;
  if request_end_date < request_start_date then
    raise exception 'Time-off end date must not precede its start';
  end if;
  insert into public.time_off_requests (
    organization_id, employee_id, start_date, end_date, reason
  ) values (
    target_organization_id, target_employee_id, request_start_date,
    request_end_date, trim(coalesce(request_reason, ''))
  ) returning id into request_id;
  return request_id;
end;
$$;

create or replace function public.cancel_my_time_off_request(target_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_request public.time_off_requests%rowtype;
begin
  select request.* into target_request
  from public.time_off_requests request where request.id = target_request_id;
  if not found
     or not public.has_permission(target_request.organization_id, 'timeoff.request')
     or target_request.employee_id <> public.current_employee_id(target_request.organization_id) then
    raise exception 'Time-off request not found or not owned by the current employee' using errcode = '42501';
  end if;
  if target_request.status <> 'pending' then
    raise exception 'Only pending time-off requests can be cancelled';
  end if;
  update public.time_off_requests set status = 'cancelled'
  where id = target_request.id;
end;
$$;

create or replace function public.review_time_off_request(
  target_request_id uuid,
  review_status public.time_off_request_status,
  review_note text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_request public.time_off_requests%rowtype;
  reviewer_profile_id uuid;
begin
  if review_status not in ('approved', 'denied') then
    raise exception 'Review status must be approved or denied';
  end if;
  select request.* into target_request
  from public.time_off_requests request where request.id = target_request_id;
  if not found or not public.has_permission(target_request.organization_id, 'timeoff.approve') then
    raise exception 'Time-off approval permission required' using errcode = '42501';
  end if;
  if target_request.status <> 'pending' then
    raise exception 'Only pending time-off requests can be reviewed';
  end if;
  reviewer_profile_id := public.current_profile_id();
  if exists (
    select 1 from public.employees employee
    where employee.id = target_request.employee_id
      and employee.organization_id = target_request.organization_id
      and employee.profile_id = reviewer_profile_id
  ) then
    raise exception 'Employees cannot approve or deny their own time-off request' using errcode = '42501';
  end if;
  update public.time_off_requests set
    status = review_status,
    reviewed_by = reviewer_profile_id,
    reviewed_at = now(),
    manager_note = trim(coalesce(review_note, ''))
  where id = target_request.id;
end;
$$;

revoke all on public.employee_availability, public.time_off_requests from anon;
revoke all on public.employee_availability, public.time_off_requests from authenticated;
grant select on public.employee_availability, public.time_off_requests to authenticated;

revoke all on function public.save_my_availability(uuid, smallint, boolean, time, time, date, date) from public;
grant execute on function public.save_my_availability(uuid, smallint, boolean, time, time, date, date) to authenticated;
revoke all on function public.delete_my_availability(uuid) from public;
grant execute on function public.delete_my_availability(uuid) to authenticated;
revoke all on function public.create_my_time_off_request(uuid, date, date, text) from public;
grant execute on function public.create_my_time_off_request(uuid, date, date, text) to authenticated;
revoke all on function public.cancel_my_time_off_request(uuid) from public;
grant execute on function public.cancel_my_time_off_request(uuid) to authenticated;
revoke all on function public.review_time_off_request(uuid, public.time_off_request_status, text) from public;
grant execute on function public.review_time_off_request(uuid, public.time_off_request_status, text) to authenticated;

comment on table public.employee_availability is
  'Recurring employee availability with effective dates. Scheduling reads this data for warnings and never rewrites shifts.';
comment on table public.time_off_requests is
  'Employee-owned requests with manager decisions. Approved requests are scheduling warning inputs only.';
