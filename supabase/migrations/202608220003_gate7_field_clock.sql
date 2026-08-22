-- Gate 7: optional, employee-initiated field clock verification at assigned jobs.

create type public.field_clock_verification_status as enum (
  'verified', 'outside_radius', 'low_accuracy', 'not_required', 'overridden'
);

alter table public.jobs
  add column latitude numeric(9, 6),
  add column longitude numeric(9, 6),
  add constraint jobs_coordinates_together check ((latitude is null) = (longitude is null)),
  add constraint jobs_latitude_range check (latitude is null or latitude between -90 and 90),
  add constraint jobs_longitude_range check (longitude is null or longitude between -180 and 180);

create table public.field_clock_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  enabled boolean not null default false,
  allowed_radius_m integer not null default 150 check (allowed_radius_m between 25 and 5000),
  max_accuracy_m integer not null default 100 check (max_accuracy_m between 5 and 1000),
  manager_override_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.field_clock_verifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null,
  job_id uuid not null,
  time_entry_id uuid,
  submitted_latitude numeric(9, 6) not null check (submitted_latitude between -90 and 90),
  submitted_longitude numeric(9, 6) not null check (submitted_longitude between -180 and 180),
  submitted_accuracy_m numeric(10, 2) not null check (submitted_accuracy_m >= 0),
  expected_latitude numeric(9, 6) not null check (expected_latitude between -90 and 90),
  expected_longitude numeric(9, 6) not null check (expected_longitude between -180 and 180),
  allowed_radius_m integer not null check (allowed_radius_m between 25 and 5000),
  calculated_distance_m numeric(12, 2) not null check (calculated_distance_m >= 0),
  initial_status public.field_clock_verification_status not null,
  status public.field_clock_verification_status not null,
  attempted_at timestamptz not null default clock_timestamp(),
  overridden_by uuid references public.profiles(id) on delete set null,
  overridden_at timestamptz,
  override_reason text not null default '' check (char_length(override_reason) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (time_entry_id),
  foreign key (employee_id, organization_id)
    references public.employees(id, organization_id) on delete restrict,
  foreign key (job_id, organization_id)
    references public.jobs(id, organization_id) on delete restrict,
  foreign key (time_entry_id, organization_id)
    references public.time_entries(id, organization_id) on delete restrict,
  check (initial_status in ('verified', 'outside_radius', 'low_accuracy', 'not_required')),
  check (status = initial_status or (status = 'overridden' and initial_status in ('outside_radius', 'low_accuracy'))),
  check (
    (status <> 'overridden' and overridden_by is null and overridden_at is null and override_reason = '')
    or (status = 'overridden' and overridden_by is not null and overridden_at is not null
      and char_length(trim(override_reason)) > 0)
  )
);

create index field_clock_verifications_employee_attempt
  on public.field_clock_verifications (organization_id, employee_id, attempted_at desc);
create index field_clock_verifications_manager_review
  on public.field_clock_verifications (organization_id, status, attempted_at desc);

insert into public.field_clock_settings (organization_id)
select id from public.organizations on conflict do nothing;

create or replace function public.create_field_clock_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.field_clock_settings (organization_id) values (new.id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger organizations_create_field_clock_settings
after insert on public.organizations
for each row execute function public.create_field_clock_settings();

create trigger field_clock_settings_set_updated_at before update on public.field_clock_settings
for each row execute function public.set_updated_at();
create trigger field_clock_verifications_set_updated_at before update on public.field_clock_verifications
for each row execute function public.set_updated_at();
create trigger field_clock_settings_audit after insert or update or delete on public.field_clock_settings
for each row execute function public.capture_audit_event();
create trigger field_clock_verifications_audit after insert or update or delete on public.field_clock_verifications
for each row execute function public.capture_audit_event();

insert into public.permissions (capability, description) values
  ('field_clock.use', 'Submit one-time location verification for an assigned field-job clock-in'),
  ('field_clock.manage', 'Configure field clock rules and review organization verification attempts'),
  ('field_clock.override', 'Override a failed field clock verification with an audit reason');

insert into public.role_permissions (organization_id, role_id, permission_id)
select role.organization_id, role.id, permission.id
from public.roles role
join public.permissions permission on (
  role.name in ('Owner', 'Manager')
  or (role.name = 'Employee' and permission.capability = 'field_clock.use')
)
where role.is_system
  and permission.capability in ('field_clock.use', 'field_clock.manage', 'field_clock.override')
on conflict do nothing;

create or replace function public.grant_field_clock_role_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_system and new.name in ('Manager', 'Employee') then
    insert into public.role_permissions (organization_id, role_id, permission_id)
    select new.organization_id, new.id, permission.id
    from public.permissions permission
    where (new.name = 'Manager' and permission.capability in (
      'field_clock.use', 'field_clock.manage', 'field_clock.override'
    )) or (new.name = 'Employee' and permission.capability = 'field_clock.use')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger roles_grant_field_clock_permissions
after insert on public.roles
for each row execute function public.grant_field_clock_role_permissions();

update public.organization_modules set enabled = true where module_key = 'gps';

create or replace function public.enable_field_clock_module()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.module_key = 'gps' then new.enabled = true; end if;
  return new;
end;
$$;

create trigger modules_enable_field_clock before insert on public.organization_modules
for each row execute function public.enable_field_clock_module();

alter table public.field_clock_settings enable row level security;
alter table public.field_clock_verifications enable row level security;

create policy field_clock_settings_select_capability on public.field_clock_settings for select to authenticated
using (
  public.has_permission(organization_id, 'field_clock.use')
  or public.has_permission(organization_id, 'field_clock.manage')
);

create policy field_clock_verifications_select_capability on public.field_clock_verifications for select to authenticated
using (
  public.has_permission(organization_id, 'field_clock.manage')
  or (
    public.has_permission(organization_id, 'field_clock.use')
    and employee_id = public.current_employee_id(organization_id)
  )
);

create or replace function public.field_clock_distance_m(
  latitude_a numeric,
  longitude_a numeric,
  latitude_b numeric,
  longitude_b numeric
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select 6371000 * 2 * asin(sqrt(
    power(sin(radians((latitude_b - latitude_a)::double precision) / 2), 2)
    + cos(radians(latitude_a::double precision)) * cos(radians(latitude_b::double precision))
    * power(sin(radians((longitude_b - longitude_a)::double precision) / 2), 2)
  ));
$$;

create or replace function public.perform_employee_clock_in(
  target_organization_id uuid,
  target_employee_id uuid,
  target_location_id uuid,
  target_shift_id uuid,
  target_profile_id uuid,
  event_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare entry_id uuid;
begin
  perform 1 from public.employees employee
  where employee.id = target_employee_id and employee.organization_id = target_organization_id
  for update;
  if not found then raise exception 'An active employee profile is required' using errcode = '42501'; end if;
  if exists (
    select 1 from public.time_entries entry
    where entry.organization_id = target_organization_id
      and entry.employee_id = target_employee_id and entry.status = 'open'
  ) then
    raise exception 'Employee already has an open time entry';
  end if;
  insert into public.time_entries (
    organization_id, employee_id, shift_id, location_id,
    clock_in_at, status, source, created_by
  ) values (
    target_organization_id, target_employee_id, target_shift_id, target_location_id,
    event_at, 'open', 'employee', target_profile_id
  ) returning id into entry_id;
  return entry_id;
exception
  when unique_violation then raise exception 'Employee already has an open time entry';
end;
$$;

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
declare target_employee_id uuid;
begin
  if not public.has_permission(target_organization_id, 'timeclock.use') then
    raise exception 'Time-clock use permission required' using errcode = '42501';
  end if;
  target_employee_id := public.current_employee_id(target_organization_id);
  if target_employee_id is null then
    raise exception 'An active employee profile is required' using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.field_clock_settings setting
    join public.jobs job on job.organization_id = setting.organization_id
    where setting.organization_id = target_organization_id
      and setting.enabled
      and job.status in ('scheduled', 'in_progress')
      and job.latitude is not null and job.longitude is not null
      and public.employee_can_view_job(job.id, job.organization_id, job.scheduled_start)
  ) then
    raise exception 'Field location verification is required for an assigned job';
  end if;
  return public.perform_employee_clock_in(
    target_organization_id, target_employee_id, target_location_id, target_shift_id,
    public.current_profile_id(), clock_timestamp()
  );
end;
$$;

create or replace function public.field_clock_attempt(
  target_organization_id uuid,
  target_job_id uuid,
  target_location_id uuid,
  target_shift_id uuid,
  submitted_latitude numeric,
  submitted_longitude numeric,
  submitted_accuracy_m numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_employee_id uuid;
  target_job public.jobs%rowtype;
  settings public.field_clock_settings%rowtype;
  result_status public.field_clock_verification_status;
  distance_m numeric;
  verification_id uuid;
  entry_id uuid;
  event_at timestamptz := clock_timestamp();
begin
  if not public.has_permission(target_organization_id, 'timeclock.use')
    or not public.has_permission(target_organization_id, 'field_clock.use') then
    raise exception 'Field-clock use permission required' using errcode = '42501';
  end if;
  target_employee_id := public.current_employee_id(target_organization_id);
  if target_employee_id is null then
    raise exception 'An active employee profile is required' using errcode = '42501';
  end if;
  if submitted_latitude not between -90 and 90 or submitted_longitude not between -180 and 180
    or submitted_accuracy_m < 0 then
    raise exception 'Submitted location is invalid';
  end if;
  select setting.* into settings from public.field_clock_settings setting
  where setting.organization_id = target_organization_id;
  if not found then raise exception 'Field-clock settings are unavailable'; end if;
  select job.* into target_job from public.jobs job
  where job.id = target_job_id and job.organization_id = target_organization_id;
  if not found or target_job.status not in ('scheduled', 'in_progress')
    or not public.employee_can_view_job(target_job.id, target_job.organization_id, target_job.scheduled_start) then
    raise exception 'Choose an assigned scheduled or in-progress job' using errcode = '42501';
  end if;
  if target_job.latitude is null or target_job.longitude is null then
    raise exception 'The selected job does not have verification coordinates';
  end if;
  distance_m := public.field_clock_distance_m(
    submitted_latitude, submitted_longitude, target_job.latitude, target_job.longitude
  );
  if not settings.enabled then
    result_status := 'not_required';
  elsif submitted_accuracy_m > settings.max_accuracy_m then
    result_status := 'low_accuracy';
  elsif distance_m > settings.allowed_radius_m then
    result_status := 'outside_radius';
  else
    result_status := 'verified';
  end if;
  insert into public.field_clock_verifications (
    organization_id, employee_id, job_id, submitted_latitude, submitted_longitude,
    submitted_accuracy_m, expected_latitude, expected_longitude, allowed_radius_m,
    calculated_distance_m, initial_status, status, attempted_at
  ) values (
    target_organization_id, target_employee_id, target_job.id, submitted_latitude,
    submitted_longitude, submitted_accuracy_m, target_job.latitude, target_job.longitude,
    settings.allowed_radius_m, distance_m, result_status, result_status, event_at
  ) returning id into verification_id;
  if result_status in ('verified', 'not_required') then
    entry_id := public.perform_employee_clock_in(
      target_organization_id, target_employee_id, target_location_id, target_shift_id,
      public.current_profile_id(), event_at
    );
    update public.field_clock_verifications set time_entry_id = entry_id where id = verification_id;
  end if;
  return jsonb_build_object(
    'verificationId', verification_id,
    'timeEntryId', entry_id,
    'status', result_status,
    'distanceM', round(distance_m, 2)
  );
end;
$$;

create or replace function public.configure_field_clock(
  target_organization_id uuid,
  field_clock_enabled boolean,
  field_allowed_radius_m integer,
  field_max_accuracy_m integer,
  field_manager_override_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission(target_organization_id, 'field_clock.manage') then
    raise exception 'Field-clock management permission required' using errcode = '42501';
  end if;
  update public.field_clock_settings set
    enabled = field_clock_enabled,
    allowed_radius_m = field_allowed_radius_m,
    max_accuracy_m = field_max_accuracy_m,
    manager_override_enabled = field_manager_override_enabled
  where organization_id = target_organization_id;
  if not found then raise exception 'Field-clock settings are unavailable'; end if;
end;
$$;

create or replace function public.field_update_job_coordinates(
  target_job_id uuid,
  target_latitude numeric,
  target_longitude numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target_job public.jobs%rowtype;
begin
  select job.* into target_job from public.jobs job where job.id = target_job_id for update;
  if not found or not public.has_permission(target_job.organization_id, 'field_clock.manage') then
    raise exception 'Field-clock management permission required' using errcode = '42501';
  end if;
  if (target_latitude is null) <> (target_longitude is null) then
    raise exception 'Provide both latitude and longitude or leave both blank';
  end if;
  update public.jobs set latitude = target_latitude, longitude = target_longitude
  where id = target_job.id;
end;
$$;

create or replace function public.override_field_clock_verification(
  target_verification_id uuid,
  manager_override_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target_verification public.field_clock_verifications%rowtype;
begin
  select verification.* into target_verification
  from public.field_clock_verifications verification
  where verification.id = target_verification_id for update;
  if not found or not public.has_permission(target_verification.organization_id, 'field_clock.override') then
    raise exception 'Field-clock override permission required' using errcode = '42501';
  end if;
  if not (select manager_override_enabled from public.field_clock_settings
    where organization_id = target_verification.organization_id) then
    raise exception 'Manager overrides are disabled';
  end if;
  if target_verification.status not in ('outside_radius', 'low_accuracy')
    or target_verification.time_entry_id is not null then
    raise exception 'Only an unresolved failed verification can be overridden';
  end if;
  if char_length(trim(coalesce(manager_override_reason, ''))) < 3 then
    raise exception 'An override reason of at least 3 characters is required';
  end if;
  update public.field_clock_verifications set
    status = 'overridden', overridden_by = public.current_profile_id(),
    overridden_at = clock_timestamp(), override_reason = trim(manager_override_reason)
  where id = target_verification.id;
end;
$$;

create or replace function public.field_clock_in_with_override(
  target_verification_id uuid,
  target_location_id uuid,
  target_shift_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_verification public.field_clock_verifications%rowtype;
  target_employee_id uuid;
  target_job public.jobs%rowtype;
  entry_id uuid;
begin
  select verification.* into target_verification
  from public.field_clock_verifications verification
  where verification.id = target_verification_id for update;
  if not found or not public.has_permission(target_verification.organization_id, 'timeclock.use')
    or not public.has_permission(target_verification.organization_id, 'field_clock.use') then
    raise exception 'Field-clock use permission required' using errcode = '42501';
  end if;
  target_employee_id := public.current_employee_id(target_verification.organization_id);
  if target_employee_id is null or target_employee_id <> target_verification.employee_id then
    raise exception 'The override does not belong to the current employee' using errcode = '42501';
  end if;
  if target_verification.status <> 'overridden' or target_verification.time_entry_id is not null then
    raise exception 'An unused approved override is required';
  end if;
  select job.* into target_job from public.jobs job
  where job.id = target_verification.job_id and job.organization_id = target_verification.organization_id;
  if not found or target_job.status not in ('scheduled', 'in_progress')
    or not public.employee_can_view_job(target_job.id, target_job.organization_id, target_job.scheduled_start) then
    raise exception 'The approved job is no longer eligible for clock-in';
  end if;
  entry_id := public.perform_employee_clock_in(
    target_verification.organization_id, target_employee_id, target_location_id,
    target_shift_id, public.current_profile_id(), clock_timestamp()
  );
  update public.field_clock_verifications set time_entry_id = entry_id where id = target_verification.id;
  return entry_id;
end;
$$;

revoke all on public.field_clock_settings, public.field_clock_verifications from anon;
revoke all on public.field_clock_settings, public.field_clock_verifications from authenticated;
grant select on public.field_clock_settings, public.field_clock_verifications to authenticated;

revoke all on function public.field_clock_distance_m(numeric, numeric, numeric, numeric) from public;
revoke all on function public.perform_employee_clock_in(uuid, uuid, uuid, uuid, uuid, timestamptz) from public;
revoke all on function public.field_clock_attempt(uuid, uuid, uuid, uuid, numeric, numeric, numeric) from public;
grant execute on function public.field_clock_attempt(uuid, uuid, uuid, uuid, numeric, numeric, numeric) to authenticated;
revoke all on function public.configure_field_clock(uuid, boolean, integer, integer, boolean) from public;
grant execute on function public.configure_field_clock(uuid, boolean, integer, integer, boolean) to authenticated;
revoke all on function public.field_update_job_coordinates(uuid, numeric, numeric) from public;
grant execute on function public.field_update_job_coordinates(uuid, numeric, numeric) to authenticated;
revoke all on function public.override_field_clock_verification(uuid, text) from public;
grant execute on function public.override_field_clock_verification(uuid, text) to authenticated;
revoke all on function public.field_clock_in_with_override(uuid, uuid, uuid) from public;
grant execute on function public.field_clock_in_with_override(uuid, uuid, uuid) to authenticated;

comment on table public.field_clock_verifications is
  'One row per employee-initiated clock-in location attempt; no continuous or background tracking.';
comment on function public.perform_employee_clock_in(uuid, uuid, uuid, uuid, uuid, timestamptz) is
  'Shared protected Gate 4 clock-in primitive used by standard and verified field clock paths.';
