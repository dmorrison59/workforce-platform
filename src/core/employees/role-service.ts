import { createClient } from "@/lib/supabase/server";
import type { OrganizationRole } from "./role-schema";

const LAST_OWNER_MESSAGE = "This organization must always have at least one Owner. Promote another Owner before changing this role.";

export class MembershipRoleChangeError extends Error {}

export function membershipRoleChangeMessage(error: { code?: string; message?: string }) {
  const message = error.message ?? "";
  if (message.includes("must always have at least one Owner")) return LAST_OWNER_MESSAGE;
  if (error.code === "42501" || message.includes("role-management permission")) {
    return "Only an Owner can change organization roles.";
  }
  if (message.includes("Only active organization memberships")) {
    return "Only active organization members can have their role changed.";
  }
  if (message.includes("Organization membership not found")) {
    return "That active organization member could not be found.";
  }
  if (message.includes("Invalid organization role") || message.includes("built-in role is not available")) {
    return "Choose an available Employee, Manager, or Owner role.";
  }
  return "The role could not be changed. Refresh the page and try again.";
}

export async function changeMembershipRole(
  organizationId: string,
  membershipId: string,
  role: OrganizationRole,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("change_organization_membership_role", {
    target_organization_id: organizationId,
    target_membership_id: membershipId,
    requested_role: role,
  });

  if (error) throw new MembershipRoleChangeError(membershipRoleChangeMessage(error));
  return data;
}
