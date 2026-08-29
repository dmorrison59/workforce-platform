-- Server-side writes only: grant the service role access to domain_events.
-- No grants for anon/authenticated on purpose (events are not client-readable yet).
grant all on table public.domain_events to service_role;