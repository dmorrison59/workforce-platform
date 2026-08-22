-- Gate 6: tenant-scoped crews, effective memberships, jobs, and assignments.

create type public.job_status as enum ('draft', 'scheduled', 'in_progress', 'completed', 'cancelled');

create table public.crews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  crew_leader_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (id, organization_id),
  foreign key (crew_leader_id, organization_id)
    references public.employees(id, organization_id) on delete restrict
);

create table public.crew_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  crew_id uuid not null,
  employee_id uuid not null,
  effective_from date not null,
  effective_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_until is null or effective_until >= effective_from),
  unique (crew_id, employee_id, effective_from),
  unique (id, organization_id),
  foreign key (crew_id, organization_id)
    references public.crews(id, organization_id) on delete cascade,
  foreign key (employee_id, organization_id)
    references public.employees(id, organization_id) on delete restrict
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_name text not null check (char_length(trim(customer_name)) between 1 and 160),
  job_name text not null check (char_length(trim(job_name)) between 1 and 160),
  location_id uuid,
  address text not null check (char_length(trim(address)) between 1 and 500),
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  status public.job_status not null default 'draft',
  notes text not null default '' check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end > scheduled_start),
  unique (id, organization_id),
  foreign key (location_id, organization_id)
    references public.locations(id, organization_id) on delete restrict
);

create table public.job_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null,
  crew_id uuid,
  employee_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(crew_id, employee_id) = 1),
  unique (id, organization_id),
  foreign key (job_id, organization_id)
    references public.jobs(id, organization_id) on delete cascade,
  foreign key (crew_id, organization_id)
    references public.crews(id, organization_id) on delete restrict,
  foreign key (employee_id, organization_id)
    references public.employees(id, organization_id) on delete restrict
);

create unique index job_assignments_unique_crew
  on public.job_assignments (job_id, crew_id) where crew_id is not null;
create unique index job_assignments_unique_employee
  on public.job_assignments (job_id, employee_id) where employee_id is not null;
create index crew_members_employee_dates
  on public.crew_members (employee_id, effective_from, effective_until);
create index jobs_organization_schedule
  on public.jobs (organization_id, scheduled_start);

create trigger crews_set_updated_at before update on public.crews
for each row execute function public.set_updated_at();
create trigger crew_members_set_updated_at before update on public.crew_members
for each row execute function public.set_updated_at();
create trigger jobs_set_updated_at before update on public.jobs
for each row execute function public.set_updated_at();
create trigger job_assignments_set_updated_at before update on public.job_assignments
for each row execute function public.set_updated_at();

create or replace function public.validate_crew_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.crews crew
    where crew.id = new.crew_id and crew.organization_id = new.organization_id and crew.active
  ) then
    raise exception 'Crew must be active and belong to the organization';
  end if;
  if not exists (
    select 1 from public.employees employee
    where employee.id = new.employee_id and employee.organization_id = new.organization_id
      and employee.employment_status = 'active'
  ) then
    raise exception 'Employee must be active and belong to the organization';
  end if;
  if exists (
    select 1 from public.crew_members membership
    where membership.crew_id = new.crew_id
      and membership.employee_id = new.employee_id
      and membership.id <> new.id
      and daterange(membership.effective_from, membership.effective_until, '[]')
        && daterange(new.effective_from, new.effective_until, '[]')
  ) then
    raise exception 'Crew membership dates overlap an existing membership';
  end if;
  return new;
end;
$$;

create trigger crew_members_validate before insert or update on public.crew_members
for each row execute function public.validate_crew_membership();

create or replace function public.validate_job_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.status in ('completed', 'cancelled') then
    raise exception 'Completed and cancelled jobs are read-only';
  end if;
  if tg_op = 'UPDATE' and new.status <> old.status and not (
    (old.status = 'draft' and new.status in ('scheduled', 'cancelled'))
    or (old.status = 'scheduled' and new.status in ('in_progress', 'completed', 'cancelled'))
    or (old.status = 'in_progress' and new.status in ('completed', 'cancelled'))
  ) then
    raise exception 'Invalid job status transition';
  end if;
  return new;
end;
$$;

create trigger jobs_validate_change before update on public.jobs
for each row execute function public.validate_job_change();

create or replace function public.validate_job_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_status public.job_status;
begin
  select job.status into target_status from public.jobs job
  where job.id = new.job_id and job.organization_id = new.organization_id;
  if not found or target_status not in ('scheduled', 'in_progress') then
    raise exception 'Only scheduled or in-progress jobs can receive assignments';
  end if;
  if new.crew_id is not null and not exists (
    select 1 from public.crews crew
    where crew.id = new.crew_id and crew.organization_id = new.organization_id and crew.active
  ) then
    raise exception 'Assigned crew must be active and belong to the organization';
  end if;
  if new.employee_id is not null and not exists (
    select 1 from public.employees employee
    where employee.id = new.employee_id and employee.organization_id = new.organization_id
      and employee.employment_status = 'active'
  ) then
    raise exception 'Assigned employee must be active and belong to the organization';
  end if;
  return new;
end;
$$;

create trigger job_assignments_validate before insert or update on public.job_assignments
for each row execute function public.validate_job_assignment();

create or replace function public.employee_can_view_job(
  target_job_id uuid,
  target_organization_id uuid,
  target_scheduled_start timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.job_assignments assignment
    left join public.crew_members membership
      on membership.crew_id = assignment.crew_id
      and membership.organization_id = assignment.organization_id
    join public.organizations organization on organization.id = assignment.organization_id
    where assignment.job_id = target_job_id
      and assignment.organization_id = target_organization_id
      and (
        assignment.employee_id = public.current_employee_id(target_organization_id)
        or (
          membership.employee_id = public.current_employee_id(target_organization_id)
          and membership.effective_from <= (target_scheduled_start at time zone organization.timezone)::date
          and (membership.effective_until is null
            or membership.effective_until >= (target_scheduled_start at time zone organization.timezone)::date)
        )
      )
  );
$$;

alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.jobs enable row level security;
alter table public.job_assignments enable row level security;

create policy crews_select_field_access on public.crews for select to authenticated
using (
  (public.has_permission(organization_id, 'crew.view') and public.has_permission(organization_id, 'crew.manage'))
  or (
    public.has_permission(organization_id, 'crew.view')
    and exists (
      select 1 from public.job_assignments assignment
      join public.jobs job on job.id = assignment.job_id and job.organization_id = assignment.organization_id
      where assignment.crew_id = crews.id
        and public.employee_can_view_job(job.id, job.organization_id, job.scheduled_start)
    )
  )
);

create policy crew_members_select_field_access on public.crew_members for select to authenticated
using (
  (public.has_permission(organization_id, 'crew.view') and public.has_permission(organization_id, 'crew.manage'))
  or (
    public.has_permission(organization_id, 'crew.view')
    and employee_id = public.current_employee_id(organization_id)
  )
);

create policy jobs_select_field_access on public.jobs for select to authenticated
using (
  public.has_permission(organization_id, 'job.view')
  and (
    public.has_permission(organization_id, 'job.manage')
    or public.employee_can_view_job(id, organization_id, scheduled_start)
  )
);

create policy job_assignments_select_field_access on public.job_assignments for select to authenticated
using (
  (public.has_permission(organization_id, 'job.view') and public.has_permission(organization_id, 'job.manage'))
  or (
    public.has_permission(organization_id, 'job.view')
    and exists (
      select 1 from public.jobs job
      join public.organizations organization on organization.id = job.organization_id
      where job.id = job_assignments.job_id
        and job.organization_id = job_assignments.organization_id
        and (
          job_assignments.employee_id = public.current_employee_id(job.organization_id)
          or (
            job_assignments.crew_id is not null and exists (
              select 1 from public.crew_members membership
              where membership.crew_id = job_assignments.crew_id
                and membership.employee_id = public.current_employee_id(job.organization_id)
                and membership.organization_id = job.organization_id
                and membership.effective_from <= (job.scheduled_start at time zone organization.timezone)::date
                and (membership.effective_until is null
                  or membership.effective_until >= (job.scheduled_start at time zone organization.timezone)::date)
            )
          )
        )
    )
  )
);

create or replace function public.field_create_crew(
  target_organization_id uuid,
  crew_name text,
  target_crew_leader_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare new_crew_id uuid;
begin
  if not public.has_permission(target_organization_id, 'crew.manage') then
    raise exception 'Crew management permission required' using errcode = '42501';
  end if;
  if target_crew_leader_id is not null and not exists (
    select 1 from public.employees employee
    where employee.id = target_crew_leader_id and employee.organization_id = target_organization_id
      and employee.employment_status = 'active'
  ) then
    raise exception 'Crew leader must be an active employee in the organization';
  end if;
  insert into public.crews (organization_id, name, crew_leader_id)
  values (target_organization_id, trim(crew_name), target_crew_leader_id)
  returning id into new_crew_id;
  return new_crew_id;
end;
$$;

create or replace function public.field_update_crew(
  target_crew_id uuid,
  crew_name text,
  target_crew_leader_id uuid,
  crew_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target_crew public.crews%rowtype;
begin
  select crew.* into target_crew from public.crews crew where crew.id = target_crew_id for update;
  if not found or not public.has_permission(target_crew.organization_id, 'crew.manage') then
    raise exception 'Crew management permission required' using errcode = '42501';
  end if;
  if target_crew_leader_id is not null and not exists (
    select 1 from public.employees employee
    where employee.id = target_crew_leader_id and employee.organization_id = target_crew.organization_id
      and employee.employment_status = 'active'
  ) then
    raise exception 'Crew leader must be an active employee in the organization';
  end if;
  update public.crews set name = trim(crew_name), crew_leader_id = target_crew_leader_id,
    active = crew_active where id = target_crew.id;
end;
$$;

create or replace function public.field_add_crew_member(
  target_crew_id uuid,
  target_employee_id uuid,
  membership_effective_from date,
  membership_effective_until date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare target_crew public.crews%rowtype; new_membership_id uuid;
begin
  select crew.* into target_crew from public.crews crew where crew.id = target_crew_id;
  if not found or not public.has_permission(target_crew.organization_id, 'crew.manage') then
    raise exception 'Crew management permission required' using errcode = '42501';
  end if;
  insert into public.crew_members (organization_id, crew_id, employee_id, effective_from, effective_until)
  values (target_crew.organization_id, target_crew.id, target_employee_id,
    membership_effective_from, membership_effective_until)
  returning id into new_membership_id;
  return new_membership_id;
end;
$$;

create or replace function public.field_end_crew_membership(
  target_membership_id uuid,
  membership_effective_until date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target_membership public.crew_members%rowtype;
begin
  select membership.* into target_membership from public.crew_members membership
  where membership.id = target_membership_id for update;
  if not found or not public.has_permission(target_membership.organization_id, 'crew.manage') then
    raise exception 'Crew management permission required' using errcode = '42501';
  end if;
  if membership_effective_until < target_membership.effective_from then
    raise exception 'Membership end must be on or after its start';
  end if;
  update public.crew_members set effective_until = membership_effective_until
  where id = target_membership.id;
end;
$$;

create or replace function public.field_create_job(
  target_organization_id uuid,
  target_customer_name text,
  target_job_name text,
  target_location_id uuid,
  target_address text,
  target_scheduled_start_local timestamp without time zone,
  target_scheduled_end_local timestamp without time zone,
  target_status public.job_status,
  target_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare organization_timezone text; new_job_id uuid; resolved_start timestamptz; resolved_end timestamptz;
begin
  if not public.has_permission(target_organization_id, 'job.manage') then
    raise exception 'Job management permission required' using errcode = '42501';
  end if;
  if target_status not in ('draft', 'scheduled') then
    raise exception 'New jobs must be draft or scheduled';
  end if;
  select timezone into organization_timezone from public.organizations where id = target_organization_id;
  resolved_start := target_scheduled_start_local at time zone organization_timezone;
  resolved_end := target_scheduled_end_local at time zone organization_timezone;
  if resolved_end <= resolved_start then raise exception 'Job end must be after start'; end if;
  insert into public.jobs (
    organization_id, customer_name, job_name, location_id, address,
    scheduled_start, scheduled_end, status, notes
  ) values (
    target_organization_id, trim(target_customer_name), trim(target_job_name), target_location_id,
    trim(target_address), resolved_start, resolved_end, target_status, trim(coalesce(target_notes, ''))
  ) returning id into new_job_id;
  return new_job_id;
end;
$$;

create or replace function public.field_update_job(
  target_job_id uuid,
  target_customer_name text,
  target_job_name text,
  target_location_id uuid,
  target_address text,
  target_scheduled_start_local timestamp without time zone,
  target_scheduled_end_local timestamp without time zone,
  target_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target_job public.jobs%rowtype; organization_timezone text; resolved_start timestamptz; resolved_end timestamptz;
begin
  select job.* into target_job from public.jobs job where job.id = target_job_id for update;
  if not found or not public.has_permission(target_job.organization_id, 'job.manage') then
    raise exception 'Job management permission required' using errcode = '42501';
  end if;
  select timezone into organization_timezone from public.organizations where id = target_job.organization_id;
  resolved_start := target_scheduled_start_local at time zone organization_timezone;
  resolved_end := target_scheduled_end_local at time zone organization_timezone;
  if resolved_end <= resolved_start then raise exception 'Job end must be after start'; end if;
  update public.jobs set customer_name = trim(target_customer_name), job_name = trim(target_job_name),
    location_id = target_location_id, address = trim(target_address), scheduled_start = resolved_start,
    scheduled_end = resolved_end, notes = trim(coalesce(target_notes, '')) where id = target_job.id;
end;
$$;

create or replace function public.field_change_job_status(
  target_job_id uuid,
  target_status public.job_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target_job public.jobs%rowtype;
begin
  select job.* into target_job from public.jobs job where job.id = target_job_id for update;
  if not found or not public.has_permission(target_job.organization_id, 'job.manage') then
    raise exception 'Job management permission required' using errcode = '42501';
  end if;
  update public.jobs set status = target_status where id = target_job.id;
end;
$$;

create or replace function public.field_assign_job(
  target_job_id uuid,
  target_crew_id uuid default null,
  target_employee_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare target_job public.jobs%rowtype; new_assignment_id uuid;
begin
  select job.* into target_job from public.jobs job where job.id = target_job_id;
  if not found or not public.has_permission(target_job.organization_id, 'job.assign') then
    raise exception 'Job assignment permission required' using errcode = '42501';
  end if;
  if num_nonnulls(target_crew_id, target_employee_id) <> 1 then
    raise exception 'Choose exactly one crew or employee assignment target';
  end if;
  insert into public.job_assignments (organization_id, job_id, crew_id, employee_id)
  values (target_job.organization_id, target_job.id, target_crew_id, target_employee_id)
  returning id into new_assignment_id;
  return new_assignment_id;
end;
$$;

create or replace function public.field_unassign_job(target_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target_assignment public.job_assignments%rowtype; target_status public.job_status;
begin
  select assignment.* into target_assignment from public.job_assignments assignment
  where assignment.id = target_assignment_id for update;
  if not found or not public.has_permission(target_assignment.organization_id, 'job.assign') then
    raise exception 'Job assignment permission required' using errcode = '42501';
  end if;
  select status into target_status from public.jobs where id = target_assignment.job_id;
  if target_status in ('completed', 'cancelled') then
    raise exception 'Completed and cancelled job assignments are read-only';
  end if;
  delete from public.job_assignments where id = target_assignment.id;
end;
$$;

insert into public.permissions (capability, description) values
  ('crew.view', 'View permitted field crews'),
  ('crew.manage', 'Create and manage organization crews and memberships'),
  ('job.view', 'View permitted field jobs'),
  ('job.manage', 'Create and manage organization jobs'),
  ('job.assign', 'Assign crews and employees to jobs');

insert into public.role_permissions (organization_id, role_id, permission_id)
select role.organization_id, role.id, permission.id
from public.roles role
join public.permissions permission on (
  role.name in ('Owner', 'Manager')
  or (role.name = 'Employee' and permission.capability in ('crew.view', 'job.view'))
)
where role.is_system and permission.capability in ('crew.view', 'crew.manage', 'job.view', 'job.manage', 'job.assign')
on conflict do nothing;

create or replace function public.grant_field_role_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_system and new.name in ('Manager', 'Employee') then
    insert into public.role_permissions (organization_id, role_id, permission_id)
    select new.organization_id, new.id, permission.id from public.permissions permission
    where (
      new.name = 'Manager'
      and permission.capability in ('crew.view', 'crew.manage', 'job.view', 'job.manage', 'job.assign')
    ) or (
      new.name = 'Employee' and permission.capability in ('crew.view', 'job.view')
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger roles_grant_field_permissions after insert on public.roles
for each row execute function public.grant_field_role_permissions();

update public.organization_modules set enabled = true where module_key in ('crews', 'jobs');

create or replace function public.enable_field_modules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.module_key in ('crews', 'jobs') then new.enabled = true; end if;
  return new;
end;
$$;

create trigger modules_enable_field before insert on public.organization_modules
for each row execute function public.enable_field_modules();

create trigger crews_audit after insert or update or delete on public.crews
for each row execute function public.capture_audit_event();
create trigger crew_members_audit after insert or update or delete on public.crew_members
for each row execute function public.capture_audit_event();
create trigger jobs_audit after insert or update or delete on public.jobs
for each row execute function public.capture_audit_event();
create trigger job_assignments_audit after insert or update or delete on public.job_assignments
for each row execute function public.capture_audit_event();

revoke all on public.crews, public.crew_members, public.jobs, public.job_assignments from anon;
revoke all on public.crews, public.crew_members, public.jobs, public.job_assignments from authenticated;
grant select on public.crews, public.crew_members, public.jobs, public.job_assignments to authenticated;

revoke all on function public.employee_can_view_job(uuid, uuid, timestamptz) from public;
grant execute on function public.employee_can_view_job(uuid, uuid, timestamptz) to authenticated;
revoke all on function public.field_create_crew(uuid, text, uuid) from public;
grant execute on function public.field_create_crew(uuid, text, uuid) to authenticated;
revoke all on function public.field_update_crew(uuid, text, uuid, boolean) from public;
grant execute on function public.field_update_crew(uuid, text, uuid, boolean) to authenticated;
revoke all on function public.field_add_crew_member(uuid, uuid, date, date) from public;
grant execute on function public.field_add_crew_member(uuid, uuid, date, date) to authenticated;
revoke all on function public.field_end_crew_membership(uuid, date) from public;
grant execute on function public.field_end_crew_membership(uuid, date) to authenticated;
revoke all on function public.field_create_job(uuid, text, text, uuid, text, timestamp, timestamp, public.job_status, text) from public;
grant execute on function public.field_create_job(uuid, text, text, uuid, text, timestamp, timestamp, public.job_status, text) to authenticated;
revoke all on function public.field_update_job(uuid, text, text, uuid, text, timestamp, timestamp, text) from public;
grant execute on function public.field_update_job(uuid, text, text, uuid, text, timestamp, timestamp, text) to authenticated;
revoke all on function public.field_change_job_status(uuid, public.job_status) from public;
grant execute on function public.field_change_job_status(uuid, public.job_status) to authenticated;
revoke all on function public.field_assign_job(uuid, uuid, uuid) from public;
grant execute on function public.field_assign_job(uuid, uuid, uuid) to authenticated;
revoke all on function public.field_unassign_job(uuid) from public;
grant execute on function public.field_unassign_job(uuid) to authenticated;

comment on table public.crew_members is
  'Effective-dated crew history; overlapping periods for one employee and crew are rejected.';
comment on table public.jobs is
  'Field work scheduling owned by Gate 6; it does not create or synchronize workforce shifts.';
comment on table public.job_assignments is
  'Exactly one employee or crew target per auditable field assignment.';
