import { createClient } from "@/lib/supabase/server";
import {
  crewCreateSchema,
  crewMembershipEndSchema,
  crewMembershipSchema,
  crewUpdateSchema,
} from "@/modules/field-operations/validation/schemas";

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function createCrew(input: unknown) {
  const value = crewCreateSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("field_create_crew", {
    target_organization_id: value.organizationId,
    crew_name: value.name,
    target_crew_leader_id: value.crewLeaderId,
  });
  fail(error);
  return data;
}

export async function updateCrew(input: unknown) {
  const value = crewUpdateSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("field_update_crew", {
    target_crew_id: value.crewId,
    crew_name: value.name,
    target_crew_leader_id: value.crewLeaderId,
    crew_active: value.active,
  });
  fail(error);
}

export async function addCrewMember(input: unknown) {
  const value = crewMembershipSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("field_add_crew_member", {
    target_crew_id: value.crewId,
    target_employee_id: value.employeeId,
    membership_effective_from: value.effectiveFrom,
    membership_effective_until: value.effectiveUntil,
  });
  fail(error);
  return data;
}

export async function endCrewMembership(input: unknown) {
  const value = crewMembershipEndSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("field_end_crew_membership", {
    target_membership_id: value.membershipId,
    membership_effective_until: value.effectiveUntil,
  });
  fail(error);
}
