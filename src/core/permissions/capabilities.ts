import { createClient } from "@/lib/supabase/server";

export const capabilities = [
  "employee.view",
  "employee.manage",
  "employee_wage.view",
  "employee_wage.manage",
  "location.view",
  "location.manage",
  "department.view",
  "department.manage",
  "settings.manage",
  "schedule.view",
  "schedule.manage",
  "schedule.publish",
] as const;

export type Capability = (typeof capabilities)[number];

export async function hasCapability(organizationId: string, capability: Capability) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_permission", {
    target_organization_id: organizationId,
    requested_capability: capability,
  });
  return !error && data;
}

export async function requireCapability(organizationId: string, capability: Capability) {
  if (!(await hasCapability(organizationId, capability))) {
    throw new Error(`Missing required capability: ${capability}`);
  }
}
