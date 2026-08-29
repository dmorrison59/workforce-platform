"use server";

import { revalidatePath } from "next/cache";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { requireCapability } from "@/core/permissions/capabilities";
import { redirectWithMessage } from "@/core/shared/forms";
import { inviteEmployeeById } from "@/core/invitations/invitation-service";
import { getPublicEnvironment } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export async function inviteEmployee(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "employee.manage");
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const result = await inviteEmployeeById({
    organizationId: context.organization.id,
    employeeId: String(formData.get("employeeId") ?? ""),
    actingProfileId: profile?.id ?? null,
    userSupabase: supabase,
    admin: createAdminClient(),
    siteUrl: getPublicEnvironment().NEXT_PUBLIC_SITE_URL,
  });

  switch (result.kind) {
    case "sent":
      revalidatePath("/employees");
      return redirectWithMessage("/employees", "message", `Invite sent to ${result.email}.`);
    case "already-has-access":
      return redirectWithMessage("/employees", "warning", "This employee already has app access.");
    case "email-already-registered":
      return redirectWithMessage("/employees", "message", "That email already has an account. They can sign in and will be linked automatically.");
    case "not-found":
      return redirectWithMessage("/employees", "error", "Employee not found.");
    case "error":
      return redirectWithMessage("/employees", "error", result.message);
  }
}

export async function revokeInvitation(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "employee.manage");
  const { supabase } = await requireUser();

  const invitationId = String(formData.get("invitationId") ?? "");
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const invitationTable = (supabase as any).from("employee_invitations");
  const employeeTable = (supabase as any).from("employees");
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const { data: invitation } = await invitationTable
    .select("id, employee_id, accepted_at, revoked_at")
    .eq("id", invitationId)
    .eq("organization_id", context.organization.id)
    .maybeSingle();

  if (!invitation || invitation.accepted_at || invitation.revoked_at) {
    return redirectWithMessage("/employees", "error", "Invitation is no longer pending.");
  }

  const now = new Date().toISOString();
  const { error: revokeError } = await invitationTable
    .update({ revoked_at: now, updated_at: now })
    .eq("id", invitation.id);
  if (revokeError) return redirectWithMessage("/employees", "error", revokeError.message);

  const { error: employeeError } = await employeeTable
    .update({ app_access_status: "revoked", updated_at: now })
    .eq("id", invitation.employee_id);
  if (employeeError) return redirectWithMessage("/employees", "error", employeeError.message);

  revalidatePath("/employees");
  return redirectWithMessage("/employees", "message", "Invitation revoked.");
}