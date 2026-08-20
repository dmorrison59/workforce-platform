import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MembershipRole, Organization } from "@/types/database";

export interface OrganizationContext {
  organization: Organization;
  membershipRole: MembershipRole;
  roleName: string;
}

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/sign-in");
  return { supabase, user };
}

export async function getOrganizationContext(): Promise<OrganizationContext | null> {
  const { supabase } = await requireUser();
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id, membership_role, role_id")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const [{ data: organization }, { data: role }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", membership.organization_id).single(),
    supabase.from("roles").select("name").eq("id", membership.role_id).single(),
  ]);

  if (!organization || !role) return null;
  return {
    organization,
    membershipRole: membership.membership_role,
    roleName: role.name,
  };
}

export async function requireOrganization() {
  const context = await getOrganizationContext();
  if (!context) redirect("/organization-setup");
  return context;
}
