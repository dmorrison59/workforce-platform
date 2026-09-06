-- Mobile Gate 2: additive punch evidence and retry-safe adapters.
-- Existing clock_in/clock_out/field_clock_attempt signatures and bodies are untouched.
alter table public.time_entries
  add column clock_in_latitude numeric(9,6),
  add column clock_in_longitude numeric(9,6),
  add column clock_in_accuracy_m numeric(10,2),
  add column clock_in_captured_at timestamptz,
  add column clock_out_latitude numeric(9,6),
  add column clock_out_longitude numeric(9,6),
  add column clock_out_accuracy_m numeric(10,2),
  add column clock_out_captured_at timestamptz,
  add column mobile_clock_in_request_id uuid,
  add column mobile_clock_out_request_id uuid,
  add constraint time_entries_clock_in_gps check (
    num_nonnulls(clock_in_latitude, clock_in_longitude, clock_in_accuracy_m, clock_in_captured_at) in (0,4)
    and (clock_in_latitude is null or (clock_in_latitude between -90 and 90
      and clock_in_longitude between -180 and 180 and clock_in_accuracy_m between 0 and 100000
      and isfinite(clock_in_captured_at)))
  ),
  add constraint time_entries_clock_out_gps check (
    num_nonnulls(clock_out_latitude, clock_out_longitude, clock_out_accuracy_m, clock_out_captured_at) in (0,4)
    and (clock_out_latitude is null or (clock_out_latitude between -90 and 90
      and clock_out_longitude between -180 and 180 and clock_out_accuracy_m between 0 and 100000
      and isfinite(clock_out_captured_at) and clock_out_at is not null))
  );
create unique index time_entries_mobile_in_request_idx
  on public.time_entries(organization_id, employee_id, mobile_clock_in_request_id)
  where mobile_clock_in_request_id is not null;
create unique index time_entries_mobile_out_request_idx
  on public.time_entries(organization_id, employee_id, mobile_clock_out_request_id)
  where mobile_clock_out_request_id is not null;

-- Also deduplicate failed field attempts, which intentionally have no time entry.
alter table public.field_clock_verifications add column mobile_request_id uuid;
create unique index field_clock_mobile_request_idx
  on public.field_clock_verifications(organization_id, employee_id, mobile_request_id)
  where mobile_request_id is not null;

create function public.mobile_validate_punch(
  latitude numeric, longitude numeric, accuracy_m numeric, captured_at timestamptz
) returns void language plpgsql set search_path = '' as $$
begin
  if num_nonnulls(latitude, longitude, accuracy_m, captured_at) not in (0,4)
    or (latitude is not null and (latitude not between -90 and 90
      or longitude not between -180 and 180 or accuracy_m not between 0 and 100000
      or not isfinite(captured_at))) then
    raise exception 'Invalid punch location' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.mobile_validate_punch(numeric,numeric,numeric,timestamptz) from public, anon, authenticated;

create function public.mobile_clock_in(
  target_organization_id uuid, request_id uuid, expected_latest_entry_id uuid,
  target_location_id uuid, target_shift_id uuid default null, target_job_id uuid default null,
  submitted_latitude numeric default null, submitted_longitude numeric default null,
  submitted_accuracy_m numeric default null, captured_at timestamptz default null,
  expected_employee_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  employee_id_value uuid;
  entry_id uuid;
  latest_id uuid;
  verification public.field_clock_verifications%rowtype;
  result jsonb;
begin
  if not public.has_permission(target_organization_id, 'timeclock.use') then
    raise exception 'Time-clock use permission required' using errcode = '42501';
  end if;
  employee_id_value := public.current_employee_id(target_organization_id);
  if employee_id_value is null then
    raise exception 'An active employee profile is required' using errcode = '42501';
  end if;
  if expected_employee_id is not null and expected_employee_id <> employee_id_value then
    raise exception 'Employee context changed' using errcode = '42501';
  end if;
  if request_id is null then raise exception 'A request ID is required' using errcode = '22023'; end if;
  -- The same lock used by the existing clock-in primitive serializes devices.
  perform 1 from public.employees where id = employee_id_value and organization_id = target_organization_id for update;
  select id into entry_id from public.time_entries
  where organization_id = target_organization_id and employee_id = employee_id_value
    and mobile_clock_in_request_id = request_id;
  if found then return jsonb_build_object('timeEntryId', entry_id, 'status', 'replayed'); end if;
  select * into verification from public.field_clock_verifications
  where organization_id = target_organization_id and employee_id = employee_id_value and mobile_request_id = request_id;
  if found then return jsonb_build_object('timeEntryId', verification.time_entry_id,
    'verificationId', verification.id, 'status', verification.status); end if;
  select id into latest_id from public.time_entries
  where organization_id = target_organization_id and employee_id = employee_id_value
  order by clock_in_at desc, id desc limit 1;
  if latest_id is distinct from expected_latest_entry_id then
    raise exception 'Clock state changed; refresh before clocking in' using errcode = '40001';
  end if;
  perform public.mobile_validate_punch(submitted_latitude, submitted_longitude, submitted_accuracy_m, captured_at);
  if target_job_id is not null and submitted_latitude is not null then
    result := public.field_clock_attempt(target_organization_id, target_job_id, target_location_id,
      target_shift_id, submitted_latitude, submitted_longitude, submitted_accuracy_m);
    update public.field_clock_verifications set mobile_request_id = request_id
      where id = (result->>'verificationId')::uuid and organization_id = target_organization_id and employee_id = employee_id_value;
    entry_id := (result->>'timeEntryId')::uuid;
  else
    -- This call also enforces the existing "field verification required" guard.
    -- No GPS does not bypass it or make the standard path more restrictive.
    entry_id := public.clock_in(target_organization_id, target_location_id, target_shift_id);
    result := jsonb_build_object('timeEntryId', entry_id, 'status', 'clocked_in');
  end if;
  if entry_id is not null then
    update public.time_entries set mobile_clock_in_request_id = request_id,
      clock_in_latitude = submitted_latitude, clock_in_longitude = submitted_longitude,
      clock_in_accuracy_m = submitted_accuracy_m, clock_in_captured_at = captured_at
    where id = entry_id and organization_id = target_organization_id and employee_id = employee_id_value;
  end if;
  return result;
end;
$$;

create function public.mobile_clock_out(
  target_organization_id uuid, request_id uuid, expected_entry_id uuid,
  submitted_latitude numeric default null, submitted_longitude numeric default null,
  submitted_accuracy_m numeric default null, captured_at timestamptz default null,
  expected_employee_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  employee_id_value uuid;
  entry public.time_entries%rowtype;
begin
  if not public.has_permission(target_organization_id, 'timeclock.use') then
    raise exception 'Time-clock use permission required' using errcode = '42501';
  end if;
  employee_id_value := public.current_employee_id(target_organization_id);
  if employee_id_value is null then
    raise exception 'An active employee profile is required' using errcode = '42501';
  end if;
  if expected_employee_id is not null and expected_employee_id <> employee_id_value then
    raise exception 'Employee context changed' using errcode = '42501';
  end if;
  if request_id is null or expected_entry_id is null then
    raise exception 'Request and expected entry IDs are required' using errcode = '22023';
  end if;
  perform 1 from public.employees where id = employee_id_value and organization_id = target_organization_id for update;
  select * into entry from public.time_entries
    where id = expected_entry_id and organization_id = target_organization_id and employee_id = employee_id_value for update;
  if not found then raise exception 'Time entry is not available to this employee' using errcode = '42501'; end if;
  if entry.mobile_clock_out_request_id = request_id then return entry.id; end if;
  if entry.status <> 'open' then
    raise exception 'Clock state changed; refresh before clocking out' using errcode = '40001';
  end if;
  if exists (select 1 from public.time_entries where organization_id = target_organization_id
    and employee_id = employee_id_value and mobile_clock_out_request_id = request_id) then
    raise exception 'Request ID already used' using errcode = '40001';
  end if;
  perform public.mobile_validate_punch(submitted_latitude, submitted_longitude, submitted_accuracy_m, captured_at);
  -- Row lock + own expected entry ensure the unchanged RPC closes this entry.
  -- Its existing active-break and integrity rules are still authoritative.
  perform public.clock_out(target_organization_id);
  update public.time_entries set mobile_clock_out_request_id = request_id,
    clock_out_latitude = submitted_latitude, clock_out_longitude = submitted_longitude,
    clock_out_accuracy_m = submitted_accuracy_m, clock_out_captured_at = captured_at
  where id = entry.id;
  return entry.id;
end;
$$;

-- Invoker rights retain table RLS, including optional location/job visibility.
-- Explicit own-employee predicates also keep privileged crew accounts narrow.
create function public.mobile_clock_context(target_organization_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  employee_id_value uuid;
  active_entry jsonb;
  latest_id uuid;
  field_enabled boolean;
  assigned_jobs jsonb;
  has_open_break boolean := false;
begin
  if not public.has_permission(target_organization_id, 'timeclock.view_self') then
    raise exception 'Self time-clock visibility required' using errcode = '42501';
  end if;
  employee_id_value := public.current_employee_id(target_organization_id);
  if employee_id_value is null then raise exception 'Active employee required' using errcode = '42501'; end if;
  select id into latest_id from public.time_entries
    where organization_id = target_organization_id and employee_id = employee_id_value
    order by clock_in_at desc, id desc limit 1;
  select jsonb_build_object('id', entry.id, 'clock_in_at', entry.clock_in_at, 'location_id', entry.location_id,
    'shift_id', entry.shift_id, 'location_name', location.name) into active_entry
  from public.time_entries entry left join public.locations location
    on location.id = entry.location_id and location.organization_id = entry.organization_id
  where entry.organization_id = target_organization_id and entry.employee_id = employee_id_value and entry.status = 'open';
  if active_entry is not null then
    select exists(select 1 from public.time_breaks where organization_id = target_organization_id
      and time_entry_id = (active_entry->>'id')::uuid and end_at is null) into has_open_break;
  end if;
  select enabled into field_enabled from public.field_clock_settings where organization_id = target_organization_id;
  select coalesce(jsonb_agg(jsonb_build_object('id', job.id, 'name', job.job_name, 'location_id', job.location_id,
    'scheduled_start', job.scheduled_start, 'scheduled_end', job.scheduled_end) order by job.scheduled_start, job.id), '[]'::jsonb)
    into assigned_jobs from public.jobs job
    where job.organization_id = target_organization_id and job.status in ('scheduled','in_progress')
      and job.latitude is not null and job.longitude is not null
      and public.employee_can_view_job(job.id, job.organization_id, job.scheduled_start);
  return jsonb_build_object('employeeId', employee_id_value, 'activeEntry', active_entry,
    'latestEntryId', latest_id, 'hasOpenBreak', has_open_break,
    'canUse', public.has_permission(target_organization_id, 'timeclock.use'),
    'canUseField', public.has_permission(target_organization_id, 'field_clock.use'),
    'fieldRequired', coalesce(field_enabled, false) and jsonb_array_length(assigned_jobs) > 0,
    'jobs', assigned_jobs,
    'locations', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name), '[]'::jsonb)
      from public.locations where organization_id = target_organization_id and active));
end;
$$;

revoke all on function public.mobile_clock_in(uuid,uuid,uuid,uuid,uuid,uuid,numeric,numeric,numeric,timestamptz,uuid) from public, anon;
revoke all on function public.mobile_clock_out(uuid,uuid,uuid,numeric,numeric,numeric,timestamptz,uuid) from public, anon;
revoke all on function public.mobile_clock_context(uuid) from public, anon;
grant execute on function public.mobile_clock_in(uuid,uuid,uuid,uuid,uuid,uuid,numeric,numeric,numeric,timestamptz,uuid) to authenticated;
grant execute on function public.mobile_clock_out(uuid,uuid,uuid,numeric,numeric,numeric,timestamptz,uuid) to authenticated;
grant execute on function public.mobile_clock_context(uuid) to authenticated;
comment on column public.time_entries.clock_in_captured_at is 'Untrusted device sample time; worked time always uses existing server clock timestamps.';
comment on column public.time_entries.clock_out_captured_at is 'Untrusted device sample time; no background or continuous collection.';
notify pgrst, 'reload schema';
