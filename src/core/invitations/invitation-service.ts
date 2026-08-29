/* eslint-disable @typescript-eslint/no-explicit-any */

export type InvitationOutcome =
  | { kind: "sent"; email: string }
  | { kind: "already-has-access"; email: string }
  | { kind: "email-already-registered"; email: string; message: string }
  | { kind: "not-found" }
  | { kind: "error"; message: string };

function invitationTable(supabase: any) {
  return supabase.from("employee_invitations");
}
function employeeTable(supabase: any) {
  return supabase.from("employees");
}

export async function inviteEmployeeById(args: {
  organizationId: string;
  employeeId: string;
  actingProfileId: string | null;
  userSupabase: any;
  admin: any;
  siteUrl: string;
}): Promise<InvitationOutcome> {
  const { organizationId, employeeId, actingProfileId, userSupabase, admin, siteUrl } = args;

  const { data: employee } = await employeeTable(userSupabase)
    .select("id, email, profile_id, app_access_status")
    .eq("id", employeeId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!employee) return { kind: "not-found" };
  if (employee.profile_id || employee.app_access_status === "active") {
    return { kind: "already-has-access", email: employee.email };
  }

  const { data: authUser, error } = await admin.auth.admin.inviteUserByEmail(employee.email, {
    redirectTo: `${siteUrl}/auth/callback`,
  });
  const invitedAuthUserId = authUser?.user?.id ?? null;

  if (error || !invitedAuthUserId) {
    if (error && /already|registered|exists/i.test(error.message)) {
      return { kind: "email-already-registered", email: employee.email, message: error.message };
    }
    return { kind: "error", message: error?.message ?? "Invite could not be sent." };
  }

  const now = new Date().toISOString();
  const { data: pending } = await invitationTable(userSupabase)
    .select("id")
    .eq("employee_id", employee.id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .maybeSingle();

  if (pending) {
    const { error: updateError } = await invitationTable(userSupabase)
      .update({ last_sent_at: now, auth_user_id: invitedAuthUserId, updated_at: now })
      .eq("id", pending.id);
    if (updateError) return { kind: "error", message: updateError.message };
  } else {
    const { error: insertError } = await invitationTable(userSupabase).insert({
      organization_id: organizationId,
      employee_id: employee.id,
      email: employee.email,
      auth_user_id: invitedAuthUserId,
      invited_by_profile_id: actingProfileId,
      last_sent_at: now,
    });
    if (insertError) return { kind: "error", message: insertError.message };
  }

  const { error: employeeError } = await employeeTable(userSupabase)
    .update({ app_access_status: "invited", updated_at: now })
    .eq("id", employee.id);
  if (employeeError) return { kind: "error", message: employeeError.message };

  return { kind: "sent", email: employee.email };
}