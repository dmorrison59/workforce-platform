alter table public.employees
  add column street_address text,
  add column address_line_2 text,
  add column city text,
  add column state_province text,
  add column postal_code text,
  add column country text,
  add constraint employees_street_address_length
    check (street_address is null or char_length(trim(street_address)) between 1 and 200),
  add constraint employees_address_line_2_length
    check (address_line_2 is null or char_length(trim(address_line_2)) between 1 and 120),
  add constraint employees_city_length
    check (city is null or char_length(trim(city)) between 1 and 100),
  add constraint employees_state_province_length
    check (state_province is null or char_length(trim(state_province)) between 1 and 100),
  add constraint employees_postal_code_length
    check (postal_code is null or char_length(trim(postal_code)) between 1 and 32),
  add constraint employees_country_length
    check (country is null or char_length(trim(country)) between 1 and 100),
  add constraint employees_address_completeness
    check (
      (
        street_address is null
        and address_line_2 is null
        and city is null
        and state_province is null
        and postal_code is null
        and country is null
      )
      or (
        street_address is not null
        and city is not null
        and state_province is not null
        and postal_code is not null
        and country is not null
      )
    );

drop function public.create_employee(
  uuid, text, text, text, text, text, public.employment_status, date, numeric
);

create function public.create_employee(
  target_organization_id uuid,
  employee_first_name text,
  employee_last_name text,
  employee_email text,
  employee_phone text default null,
  employee_number_value text default null,
  employee_status public.employment_status default 'active',
  employee_hire_date date default null,
  employee_hourly_rate numeric default null,
  employee_street_address text default null,
  employee_address_line_2 text default null,
  employee_city text default null,
  employee_state_province text default null,
  employee_postal_code text default null,
  employee_country text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_employee_id uuid;
begin
  if not public.has_permission(target_organization_id, 'employee.manage') then
    raise exception 'Employee management permission required' using errcode = '42501';
  end if;

  if employee_hourly_rate is not null
     and not public.has_permission(target_organization_id, 'employee_wage.manage') then
    raise exception 'Employee wage management permission required' using errcode = '42501';
  end if;

  insert into public.employees (
    organization_id, employee_number, first_name, last_name, email, phone,
    employment_status, hire_date, street_address, address_line_2, city,
    state_province, postal_code, country
  ) values (
    target_organization_id, nullif(trim(employee_number_value), ''),
    trim(employee_first_name), trim(employee_last_name), lower(trim(employee_email)),
    nullif(trim(employee_phone), ''), employee_status, employee_hire_date,
    nullif(trim(employee_street_address), ''), nullif(trim(employee_address_line_2), ''),
    nullif(trim(employee_city), ''), nullif(trim(employee_state_province), ''),
    nullif(trim(employee_postal_code), ''), nullif(trim(employee_country), '')
  ) returning id into new_employee_id;

  if employee_hourly_rate is not null then
    insert into public.employee_compensation (organization_id, employee_id, hourly_rate)
    values (target_organization_id, new_employee_id, employee_hourly_rate);
  end if;

  return new_employee_id;
end;
$$;

revoke all on function public.create_employee(
  uuid, text, text, text, text, text, public.employment_status, date, numeric,
  text, text, text, text, text, text
) from public;
grant execute on function public.create_employee(
  uuid, text, text, text, text, text, public.employment_status, date, numeric,
  text, text, text, text, text, text
) to authenticated;

comment on column public.employees.street_address is
  'Structured employee address line 1; protected by the employee tenant RLS policies.';
comment on column public.employees.address_line_2 is
  'Optional structured employee address line 2.';
comment on column public.employees.state_province is
  'Structured state, province, or administrative region.';
