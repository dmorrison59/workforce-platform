-- Time-Off Approval Rules: system approval for a linked sole Owner.

do $$
declare
  review_constraint_name text;
begin
  select constraint_record.conname
    into review_constraint_name
    from pg_catalog.pg_constraint constraint_record
   where constraint_record.conrelid = 'public.time_off_requests'::regclass
     and constraint_record.contype = 'c'
     and pg_catalog.pg_get_constraintdef(constraint_record.oid) like '%reviewed_by%'
     and pg_catalog.pg_get_constraintdef(constraint_record.oid) like '%reviewed_at%';

  if review_constraint_name is null then
    raise exception 'Time-off review metadata constraint was not found';
  end if;

  execute format(
    'alter table public.time_off_requests drop constraint %I',
    review_constraint_name
  );
end;
$$;

alter table public.time_off_requests
  add constraint time_off_requests_review_metadata_check check (
    (status in ('pending', 'cancelled') and reviewed_by is null and reviewed_at is null)
    or (status = 'approved' and reviewed_at is not null)
    or (status = 'denied' and reviewed_by is not null and reviewed_at is not null)
  );

comment on constraint time_off_requests_review_metadata_check on public.time_off_requests is
  'Approved with reviewed_by null is reserved for sole-Owner system approval. Manual decisions retain a real reviewer.';

-- Use the same organization row lock as protected role changes so the Owner count
-- cannot change between the sole-Owner decision and request insertion. These
-- triggers also serialize direct, RLS-authorized membership writes.
create or replace function public.serialize_organization_membership_owner_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform 1
      from public.organizations
     where id = new.organization_id
     for update;
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform 1
      from public.organizations
     where id = old.organization_id
     for update;
    return old;
  end if;

  perform 1
    from public.organizations
   where id in (old.organization_id, new.organization_id)
   order by id
   for update;
  return new;
end;
$$;

create trigger organization_memberships_00_serialize_owner_state_insert
before insert on public.organization_memberships
for each row execute function public.serialize_organization_membership_owner_state();

create trigger organization_memberships_00_serialize_owner_state_update
before update of organization_id, role_id, membership_role, status
on public.organization_memberships
for each row execute function public.serialize_organization_membership_owner_state();

create trigger organization_memberships_00_serialize_owner_state_delete
before delete on public.organization_memberships
for each row execute function public.serialize_organization_membership_owner_state();

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
  requester_profile_id uuid;
  requester_is_active_owner boolean;
  active_owner_count integer;
  system_approved boolean;
  request_id uuid;
begin
  if not public.has_permission(target_organization_id, 'timeoff.request') then
    raise exception 'Time-off request permission required' using errcode = '42501';
  end if;

  perform 1
    from public.organizations
   where id = target_organization_id
   for update;
  if not found then
    raise exception 'Time-off request permission required' using errcode = '42501';
  end if;

  -- Recheck after acquiring the lock in case membership changed while waiting.
  if not public.has_permission(target_organization_id, 'timeoff.request') then
    raise exception 'Time-off request permission required' using errcode = '42501';
  end if;

  requester_profile_id := public.current_profile_id();
  target_employee_id := public.current_employee_id(target_organization_id);
  if requester_profile_id is null or target_employee_id is null then
    raise exception 'An active employee profile is required' using errcode = '42501';
  end if;
  if request_end_date < request_start_date then
    raise exception 'Time-off end date must not precede its start';
  end if;

  select exists (
    select 1
      from public.organization_memberships membership
      join public.roles role
        on role.id = membership.role_id
       and role.organization_id = membership.organization_id
     where membership.organization_id = target_organization_id
       and membership.profile_id = requester_profile_id
       and membership.status = 'active'
       and membership.membership_role = 'owner'
       and role.is_system
       and role.name = 'Owner'
  ) into requester_is_active_owner;

  select count(*)::integer
    into active_owner_count
    from public.organization_memberships membership
    join public.roles role
      on role.id = membership.role_id
     and role.organization_id = membership.organization_id
   where membership.organization_id = target_organization_id
     and membership.status = 'active'
     and membership.membership_role = 'owner'
     and role.is_system
     and role.name = 'Owner';

  system_approved := requester_is_active_owner and active_owner_count = 1;

  insert into public.time_off_requests (
    organization_id, employee_id, start_date, end_date, reason,
    status, reviewed_by, reviewed_at, manager_note
  ) values (
    target_organization_id, target_employee_id, request_start_date,
    request_end_date, trim(coalesce(request_reason, '')),
    case when system_approved then 'approved'::public.time_off_request_status else 'pending'::public.time_off_request_status end,
    null,
    case when system_approved then now() else null end,
    ''
  ) returning id into request_id;

  return request_id;
end;
$$;

comment on function public.create_my_time_off_request(uuid, date, date, text) is
  'Creates the current employee request; the sole active built-in Owner is system-approved with no reviewer.';
