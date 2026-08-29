-- Domain event log: append-only record of business events.
-- Future notification delivery (email/SMS/in-app) subscribes to this table.
create table if not exists public.domain_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  subject_employee_id uuid references public.employees(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index domain_events_org_created_idx on public.domain_events (organization_id, created_at desc);
create index domain_events_type_idx on public.domain_events (event_type);

alter table public.domain_events enable row level security;
-- No client-side policies on purpose: events are written only by server services
-- through the service role. Read policies arrive with the notification UI.



