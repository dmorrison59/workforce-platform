-- Web/Admin Gate: secure management of the three built-in organization roles.

create or replace function public.protect_last_active_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_owner_role_id uuid;
  new_owner_role_id uuid;
  remaining_owner_count integer;
begin
  select id
    into old_owner_role_id
    from public.roles
   where organization_id = old.organization_id
     and is_system
     and name = 'Owner';

  if old.status <> 'active'
     or old.membership_role <> 'owner'
     or old.role_id is distinct from old_owner_role_id then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    select id
      into new_owner_role_id
      from public.roles
     where organization_id = new.organization_id
       and is_system
       and name = 'Owner';

    if new.organization_id = old.organization_id
       and new.status = 'active'
       and new.membership_role = 'owner'
       and new.role_id is not distinct from new_owner_role_id then
      return new;
    end if;
  end if;

  -- Serialize all operations that could remove an organization's final Owner.
  perform 1
    from public.organizations
   where id = old.organization_id
   for update;

  select count(*)::integer
    into remaining_owner_count
    from public.organization_memberships membership
    join public.roles role
      on role.id = membership.role_id
     and role.organization_id = membership.organization_id
   where membership.organization_id = old.organization_id
     and membership.id <> old.id
     and membership.status = 'active'
     and membership.membership_role = 'owner'
     and role.is_system
     and role.name = 'Owner';

  if remaining_owner_count = 0 then
    raise exception 'This organization must always have at least one Owner. Promote another Owner before changing this role.'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger organization_memberships_protect_last_owner_update
before update of organization_id, role_id, membership_role, status
on public.organization_memberships
for each row execute function public.protect_last_active_owner();

create trigger organization_memberships_protect_last_owner_delete
before delete on public.organization_memberships
for each row execute function public.protect_last_active_owner();

create trigger organization_memberships_audit
after insert or update or delete on public.organization_memberships
for each row execute function public.capture_audit_event();

create or replace function public.change_organization_membership_role(
  target_organization_id uuid,
  target_membership_id uuid,
  requested_role text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_role text := lower(trim(requested_role));
  desired_role_name text;
  desired_role_id uuid;
  target_membership public.organization_memberships%rowtype;
begin
  if not public.has_permission(target_organization_id, 'settings.manage') then
    raise exception 'Owner role-management permission required' using errcode = '42501';
  end if;

  -- This lock makes final-Owner checks safe when role changes race each other.
  perform 1
    from public.organizations
   where id = target_organization_id
   for update;

  if not found then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;

  desired_role_name := case normalized_role
    when 'employee' then 'Employee'
    when 'manager' then 'Manager'
    when 'owner' then 'Owner'
    else null
  end;

  if desired_role_name is null then
    raise exception 'Invalid organization role. Choose Employee, Manager, or Owner.'
      using errcode = '22023';
  end if;

  select *
    into target_membership
    from public.organization_memberships
   where id = target_membership_id
     and organization_id = target_organization_id
   for update;

  if not found then
    raise exception 'Organization membership not found.' using errcode = 'P0002';
  end if;

  if target_membership.status <> 'active' then
    raise exception 'Only active organization memberships can change roles.'
      using errcode = '55000';
  end if;

  select id
    into desired_role_id
    from public.roles
   where organization_id = target_organization_id
     and is_system
     and name = desired_role_name;

  if desired_role_id is null then
    raise exception 'Requested built-in role is not available for this organization.'
      using errcode = '55000';
  end if;

  if target_membership.role_id is not distinct from desired_role_id
     and target_membership.membership_role::text = normalized_role then
    return desired_role_name;
  end if;

  update public.organization_memberships
     set role_id = desired_role_id,
         membership_role = normalized_role::public.membership_role
   where id = target_membership_id
     and organization_id = target_organization_id;

  return desired_role_name;
end;
$$;

revoke all on function public.change_organization_membership_role(uuid, uuid, text) from public;
grant execute on function public.change_organization_membership_role(uuid, uuid, text) to authenticated;

comment on function public.change_organization_membership_role(uuid, uuid, text) is
  'Owner-authorized role change for an active membership using only the organization built-in roles.';
comment on function public.protect_last_active_owner() is
  'Prevents update or deletion from leaving an organization without an active built-in Owner membership.';
