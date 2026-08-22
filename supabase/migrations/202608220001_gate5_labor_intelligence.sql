-- Gate 5: read-only labor intelligence over existing workforce, schedule, time, and wage data.

insert into public.permissions (capability, description) values
  ('labor.view', 'View organization labor hours and operational variance'),
  ('labor.view_cost', 'View labor cost calculations when wage access is also granted');

insert into public.role_permissions (organization_id, role_id, permission_id)
select role.organization_id, role.id, permission.id
from public.roles role
join public.permissions permission on permission.capability in ('labor.view', 'labor.view_cost')
where role.is_system and role.name in ('Owner', 'Manager')
on conflict do nothing;

insert into public.role_permissions (organization_id, role_id, permission_id)
select role.organization_id, role.id, permission.id
from public.roles role
join public.permissions permission on permission.capability = 'employee_wage.view'
where role.is_system and role.name = 'Manager'
on conflict do nothing;

update public.organization_modules set enabled = true where module_key = 'labor';

create or replace function public.grant_labor_role_permissions()
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
    where permission.capability in ('labor.view', 'labor.view_cost', 'employee_wage.view')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger roles_grant_labor_permissions
after insert on public.roles
for each row execute function public.grant_labor_role_permissions();

create or replace function public.enable_labor_module()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.module_key = 'labor' then new.enabled = true; end if;
  return new;
end;
$$;

create trigger modules_enable_labor
before insert on public.organization_modules
for each row execute function public.enable_labor_module();

-- Labor may read its tenant-scoped inputs. Existing mutation policies remain unchanged.
create policy employees_select_labor on public.employees for select to authenticated
using (public.has_permission(organization_id, 'labor.view'));
create policy locations_select_labor on public.locations for select to authenticated
using (public.has_permission(organization_id, 'labor.view'));
create policy departments_select_labor on public.departments for select to authenticated
using (public.has_permission(organization_id, 'labor.view'));
create policy schedules_select_labor on public.schedules for select to authenticated
using (public.has_permission(organization_id, 'labor.view'));
create policy shifts_select_labor on public.shifts for select to authenticated
using (public.has_permission(organization_id, 'labor.view'));
create policy time_entries_select_labor on public.time_entries for select to authenticated
using (public.has_permission(organization_id, 'labor.view'));
create policy time_breaks_select_labor on public.time_breaks for select to authenticated
using (public.has_permission(organization_id, 'labor.view'));

comment on function public.grant_labor_role_permissions() is
  'Grants future system managers Gate 5 read and cost capabilities plus wage-view access. Owners receive all current permissions through create_organization.';
