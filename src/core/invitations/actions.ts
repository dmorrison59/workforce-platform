"use server";

import { revalidatePath } from "next/cache";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { requireCapability } from "@/core/permissions/capabilities";
import { redirectWithMessage } from "@/core/shared/forms";
import { getPublicEnvironment } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/* eslint-disable @typescript-eslint/no-explicit-any */
// The committed Database types predate employee_invitations and app_access_status;
// keep these queries untyped until types are regenerated and merged.
function invitationTable(supabase: unknown) {
  return (supabase as any).from("employee_invitations");
}
function employeeTable(supabase: unknown) {
  return (supabase as any).from("employees");
}

export async function inviteEmployee(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "employee.manage");

  const employeeId = String(formData.get("employeeId") ?? "");
  const { supabase, user } = await requireUser();

  const { data: employee } = await employeeTable(supabase)
    .select("id, email, profile_id, app_access_status")
    .eq("id", employeeId)
    .eq("organization_id", context.organization.id)
    .maybeSingle();

  if (!employee) redirectWithMessage("/employees", "error", "Employee not found.");
  if (employee.profile_id || employee.app_access_status === "active") {
    redirectWithMessage("/employees", "warning", "This employee already has app access.");
  }

  const environment = getPublicEnvironment();
  const admin = createAdminClient();
  const { data: authUser, error } = await admin.auth.admin.inviteUserByEmail(employee.email, {
    redirectTo: `${environment.NEXT_PUBLIC_SITE_URL}/auth/callback`,
  });
  const invitedAuthUserId = authUser.user?.id ?? null;

  if (error || !invitedAuthUserId) {
    if (error && /already|registered|exists/i.test(error.message)) {
      redirectWithMessage(
        "/employees",
        "message",
        "That email already has an account. They can sign in and will be linked automatically.",
      );
    }
    redirectWithMessage("/employees", "error", error?.message ?? "Invite could not be sent.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const now = new Date().toISOString();
  const { data: pending } = await invitationTable(supabase)
    .select("id")
    .eq("employee_id", employee.id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .maybeSingle();

  if (pending) {
    const { error: updateError } = await invitationTable(supabase)
      .update({ last_sent_at: now, auth_user_id: invitedAuthUserId, updated_at: now })
      .eq("id", pending.id);
    if (updateError) redirectWithMessage("/employees", "error", updateError.message);
  } else {
    const { error: insertError } = await invitationTable(supabase).insert({
      organization_id: context.organization.id,
      employee_id: employee.id,
      email: employee.email,
      auth_user_id: invitedAuthUserId,
      invited_by_profile_id: profile?.id ?? null,
      last_sent_at: now,
    });
    if (insertError) redirectWithMessage("/employees", "error", insertError.message);
  }

  const { error: employeeError } = await employeeTable(supabase)
    .update({ app_access_status: "invited", updated_at: now })
    .eq("id", employee.id);
  if (employeeError) redirectWithMessage("/employees", "error", employeeError.message);

  revalidatePath("/employees");
  redirectWithMessage("/employees", "message", `Invite sent to ${employee.email}.`);
}

export async function revokeInvitation(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "employee.manage");

  const invitationId = String(formData.get("invitationId") ?? "");
  const { supabase } = await requireUser();

  const { data: invitation } = await invitationTable(supabase)
    .select("id, employee_id, accepted_at, revoked_at")
    .eq("id", invitationId)
    .eq("organization_id", context.organization.id)
    .maybeSingle();

  if (!invitation || invitation.accepted_at || invitation.revoked_at) {
    redirectWithMessage("/employees", "error", "Invitation is no longer pending.");
  }

  const now = new Date().toISOString();
  const { error: revokeError } = await invitationTable(supabase)
    .update({ revoked_at: now, updated_at: now })
    .eq("id", invitation.id);
  if (revokeError) redirectWithMessage("/employees", "error", revokeError.message);

  const { error: employeeError } = await employeeTable(supabase)
    .update({ app_access_status: "revoked", updated_at: now })
    .eq("id", invitation.employee_id);
  if (employeeError) redirectWithMessage("/employees", "error", employeeError.message);

  revalidatePath("/employees");
  redirectWithMessage("/employees", "message", "Invitation revoked.");
}