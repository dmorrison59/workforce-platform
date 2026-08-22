import { createClient } from "@/lib/supabase/server";

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function getCrewManagerData(organizationId: string) {
  const supabase = await createClient();
  const [crews, memberships, employees] = await Promise.all([
    supabase.from("crews").select("*").eq("organization_id", organizationId).order("name"),
    supabase.from("crew_members").select("*").eq("organization_id", organizationId).order("effective_from", { ascending: false }),
    supabase.from("employees").select("*").eq("organization_id", organizationId).eq("employment_status", "active").order("last_name"),
  ]);
  fail(crews.error); fail(memberships.error); fail(employees.error);
  return { crews: crews.data ?? [], memberships: memberships.data ?? [], employees: employees.data ?? [] };
}

export async function getJobManagerData(organizationId: string) {
  const supabase = await createClient();
  const [jobs, assignments, crews, employees, locations] = await Promise.all([
    supabase.from("jobs").select("*").eq("organization_id", organizationId).order("scheduled_start", { ascending: false }),
    supabase.from("job_assignments").select("*").eq("organization_id", organizationId).order("created_at"),
    supabase.from("crews").select("*").eq("organization_id", organizationId).order("name"),
    supabase.from("employees").select("*").eq("organization_id", organizationId).eq("employment_status", "active").order("last_name"),
    supabase.from("locations").select("*").eq("organization_id", organizationId).eq("active", true).order("name"),
  ]);
  fail(jobs.error); fail(assignments.error); fail(crews.error); fail(employees.error); fail(locations.error);
  return {
    jobs: jobs.data ?? [], assignments: assignments.data ?? [], crews: crews.data ?? [],
    employees: employees.data ?? [], locations: locations.data ?? [],
  };
}

export async function getMyJobsData(organizationId: string) {
  const supabase = await createClient();
  const [jobs, assignments, crews] = await Promise.all([
    supabase.from("jobs").select("*").eq("organization_id", organizationId).order("scheduled_start"),
    supabase.from("job_assignments").select("*").eq("organization_id", organizationId),
    supabase.from("crews").select("*").eq("organization_id", organizationId),
  ]);
  fail(jobs.error); fail(assignments.error); fail(crews.error);
  return { jobs: jobs.data ?? [], assignments: assignments.data ?? [], crews: crews.data ?? [] };
}
