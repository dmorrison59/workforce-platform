import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { MobileDatabase } from "@/types/database";
import {
  crewCapabilities,
  type CrewCapability,
  type CrewContext,
} from "@/types/crew-context";

type Client = SupabaseClient<MobileDatabase>;

async function loadOwnMembership(client: Client, profileId: string) {
  const { data, error } = await client
    .from("organization_memberships")
    .select("organization_id, profile_id, role_id, membership_role")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (error) throw new Error("We could not load your YardClock organization.");
  return data;
}

async function loadPermission(
  client: Client,
  organizationId: string,
  capability: CrewCapability,
) {
  const { data, error } = await client.rpc("has_permission", {
    target_organization_id: organizationId,
    requested_capability: capability,
  });

  if (error) throw new Error("We could not verify your crew permissions.");
  return [capability, Boolean(data)] as const;
}

export async function loadCrewContext(client: Client, user: User): Promise<CrewContext> {
  const { data: profileId, error: profileError } = await client.rpc("current_profile_id");
  if (profileError || !profileId) {
    throw new Error("Your sign-in is missing a YardClock profile. Ask your manager for help.");
  }

  let membership = await loadOwnMembership(client, profileId);

  if (!membership) {
    const { error: invitationError } = await client.rpc("accept_employee_invitation");
    if (invitationError) {
      throw new Error("Your employee invitation could not be accepted. Ask your manager to resend it.");
    }
    membership = await loadOwnMembership(client, profileId);
  }

  if (!membership) {
    throw new Error("No active YardClock organization is linked to this account.");
  }

  const { data: employeeId, error: employeeIdError } = await client.rpc("current_employee_id", {
    target_organization_id: membership.organization_id,
  });
  if (employeeIdError || !employeeId) {
    throw new Error("This account is not linked to an active employee record.");
  }

  const [organizationResult, roleResult, employeeResult, permissionEntries] = await Promise.all([
    client
      .from("organizations")
      .select("id, name, timezone")
      .eq("id", membership.organization_id)
      .single(),
    client
      .from("roles")
      .select("id, name")
      .eq("id", membership.role_id)
      .eq("organization_id", membership.organization_id)
      .single(),
    client
      .from("employees")
      .select("id, first_name, last_name, employment_status")
      .eq("id", employeeId)
      .eq("organization_id", membership.organization_id)
      .eq("profile_id", profileId)
      .eq("employment_status", "active")
      .single(),
    Promise.all(
      crewCapabilities.map((capability) =>
        loadPermission(client, membership.organization_id, capability),
      ),
    ),
  ]);

  if (organizationResult.error || !organizationResult.data) {
    throw new Error("We could not load your YardClock organization.");
  }
  if (roleResult.error || !roleResult.data) {
    throw new Error("We could not load your YardClock role.");
  }
  if (employeeResult.error || !employeeResult.data) {
    throw new Error("We could not load your employee record.");
  }

  return {
    user: { id: user.id, email: user.email ?? null },
    organization: organizationResult.data,
    employee: employeeResult.data,
    role: {
      id: roleResult.data.id,
      name: roleResult.data.name,
      membershipRole: membership.membership_role,
    },
    permissions: Object.fromEntries(permissionEntries) as Record<CrewCapability, boolean>,
  };
}
