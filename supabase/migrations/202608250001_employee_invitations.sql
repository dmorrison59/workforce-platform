-- Employee app-access invitations (Blueprint §15 Authentication & App Access).
-- Rollback: drop triggers, function, policies, indexes, table, column, and type in reverse order.

create type public.app_access_status as enum ('none', 'invited', 'active', 'revoked');

alter table public.employees
  add column if not exists app_access_status public.app_access_status not null default 'none';

create table public.employee_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  auth_user_id uuid references auth.users(id) on delete set null,
  invited_by_profile_id uuid references public.profiles(id) on delete set null,
  invited_at timestamptz not null default now(),
  last_sent_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  revoked_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

-- One live invitation per employee, and per org+email.
create unique index employee_invitations_one_pending_per_employee
  on public.employee_invitations (employee_id)
  where accepted_at is null and revoked_at is null;
create unique index employee_invitations_one_pending_per_org_email
  on public.employee_invitations (organization_id, lower(email))
  where accepted_at is null and revoked_at is null;

create trigger employee_invitations_set_updated_at before update on public.employee_invitations
for each row execute function public.set_updated_at();

alter table public.employee_invitations enable row level security;
grant select, insert, update on public.employee_invitations to authenticated;
create policy invitations_select_capability on public.employee_invitations for select to authenticated
using (public.has_permission(organization_id, 'employee.manage'));
create policy invitations_insert_capability on public.employee_invitations for insert to authenticated
with check (public.has_permission(organization_id, 'employee.manage'));
create policy invitations_update_capability on public.employee_invitations for update to authenticated
using (public.has_permission(organization_id, 'employee.manage'))
with check (public.has_permission(organization_id, 'employee.manage'));

-- Free audit trail via the existing capture pattern.
create trigger employee_invitations_audit after insert or update or delete on public.employee_invitations
for each row execute function public.capture_audit_event();

-- Authoritative acceptance linking (mirrors the create_employee RPC pattern).
create or replace function public.accept_employee_invitation()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_email text;
  v_profile_id uuid;
  v_invitation public.employee_invitations%rowtype;
  v_employee public.employees%rowtype;
  v_membership public.organization_memberships%rowtype;
  v_role_id uuid;
begin
  select lower(email) into v_auth_email
  from auth.users
  where id = auth.uid() and email_confirmed_at is not null;
  if v_auth_email is null then
    return null;
  end if;

  select * into v_invitation
  from public.employee_invitations
  where lower(email) = v_auth_email
    and accepted_at is null
    and revoked_at is null
  order by invited_at desc
  limit 1;
  if v_invitation is null then
    return null;
  end if;

  select * into v_employee
  from public.employees
  where id = v_invitation.employee_id;
  if v_employee is null or v_employee.organization_id <> v_invitation.organization_id then
    return null;
  end if;

  select id into v_profile_id from public.profiles where auth_user_id = auth.uid();
  if v_profile_id is null then
    return null;
  end if;

  if v_employee.profile_id is not null and v_employee.profile_id <> v_profile_id then
    raise exception 'Employee record is already linked to a different profile.';
  end if;

  select * into v_membership
  from public.organization_memberships
  where organization_id = v_invitation.organization_id and profile_id = v_profile_id;
  if v_membership is not null then
    update public.employee_invitations
    set accepted_at = now()
    where id = v_invitation.id and accepted_at is null;
    return null;
  end if;

  select id into v_role_id
  from public.roles
  where organization_id = v_invitation.organization_id and is_system and name = 'Employee';
  if v_role_id is null then
    raise exception 'System Employee role is missing for this organization.';
  end if;

  -- Membership first: the employees profile-scope trigger requires it.
  insert into public.organization_memberships
    (organization_id, profile_id, role_id, membership_role, status)
  values
    (v_invitation.organization_id, v_profile_id, v_role_id, 'employee', 'active');

  update public.employees
  set profile_id = v_profile_id,
      app_access_status = 'active',
      updated_at = now()
  where id = v_employee.id
    and (profile_id is null or profile_id = v_profile_id);

  update public.employee_invitations
  set accepted_at = now(), updated_at = now()
  where id = v_invitation.id and accepted_at is null;

  return v_invitation.organization_id;
end;
$$;

revoke all on function public.accept_employee_invitation() from public;
grant execute on function public.accept_employee_invitation() to authenticated;