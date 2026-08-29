"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { createEmployeeRecord } from "@/core/employees/employee-service";
import { employeeSchema } from "@/core/employees/schema";
import { requireCapability } from "@/core/permissions/capabilities";
import { formValues } from "@/core/shared/forms";
import { addCrewMember } from "@/modules/field-operations/services/crew-service";
import { weekStartFor } from "@/modules/scheduling/lib/dates";
import { createShift, createWeeklySchedule } from "@/modules/scheduling/services/scheduling-service";
import type { FollowOnResult, OnboardingActionState } from "@/modules/onboarding/types";
import { onboardingOrchestrationSchema } from "@/modules/onboarding/validation/schema";
import { inviteEmployeeById } from "@/core/invitations/invitation-service";
import { getPublicEnvironment } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

function errorMessage(error: unknown) {
  if (error instanceof ZodError) return error.issues[0]?.message ?? "Check the onboarding details.";
  return error instanceof Error ? error.message : "The onboarding step could not be completed.";
}

async function validateWorkSetup(
  organizationId: string,
  locationId: string | null,
  departmentId: string | null,
) {
  if (!locationId || !departmentId) return;
  const { supabase } = await requireUser();
  const [location, department] = await Promise.all([
    supabase.from("locations").select("id").eq("id", locationId)
      .eq("organization_id", organizationId).eq("active", true).maybeSingle(),
    supabase.from("departments").select("id,location_id").eq("id", departmentId)
      .eq("organization_id", organizationId).eq("active", true).maybeSingle(),
  ]);
  if (location.error || !location.data) throw new Error("Choose an active location in this organization.");
  if (department.error || !department.data) throw new Error("Choose an active department in this organization.");
  if (department.data.location_id && department.data.location_id !== locationId) {
    throw new Error("The selected department does not belong to the selected location.");
  }
}

export async function onboardEmployee(
  _previousState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "employee.manage");
  const values = formValues(formData);
  const employee = employeeSchema.safeParse(values);
  if (!employee.success) {
    return { outcome: "error", message: employee.error.issues[0]?.message ?? "Check the employee details." };
  }
  const orchestration = onboardingOrchestrationSchema.safeParse(values);
  if (!orchestration.success) {
    return { outcome: "error", message: orchestration.error.issues[0]?.message ?? "Check the onboarding choices." };
  }

  try {
    await validateWorkSetup(
      context.organization.id,
      orchestration.data.workLocationId,
      orchestration.data.workDepartmentId,
    );
  } catch (error) {
    return { outcome: "error", message: errorMessage(error) };
  }

  let employeeId: string;
  try {
    employeeId = await createEmployeeRecord(context.organization.id, employee.data);
  } catch (error) {
    return { outcome: "error", message: errorMessage(error) };
  }

  const crew: FollowOnResult = orchestration.data.crewId
    ? { state: "pending", message: "Crew assignment is being completed." }
    : { state: "skipped", message: "Crew assignment was skipped." };
  if (orchestration.data.crewId) {
    try {
      await requireCapability(context.organization.id, "crew.manage");
      await addCrewMember({
        crewId: orchestration.data.crewId,
        employeeId,
        effectiveFrom: orchestration.data.crewEffectiveFrom,
        effectiveUntil: null,
      });
      crew.state = "success";
      crew.message = "Employee was added to the selected crew.";
    } catch (error) {
      crew.state = "failed";
      crew.message = `Employee was created, but crew assignment failed: ${errorMessage(error)}`;
    }
  }

  const shift: FollowOnResult = orchestration.data.createFirstShift
    ? { state: "pending", message: "First shift is being created." }
    : { state: "skipped", message: "First shift was skipped." };
  let schedulePath: string | undefined;
  if (orchestration.data.createFirstShift) {
    const shiftDate = orchestration.data.shiftDate!;
    const locationId = orchestration.data.shiftLocationId!;
    const weekStart = weekStartFor(new Date(`${shiftDate}T12:00:00Z`), "UTC");
    try {
      await requireCapability(context.organization.id, "schedule.manage");
      const scheduleId = await createWeeklySchedule({
        organizationId: context.organization.id,
        locationId,
        weekStart,
      });
      await createShift({
        organizationId: context.organization.id,
        scheduleId,
        departmentId: orchestration.data.shiftDepartmentId,
        roleId: orchestration.data.shiftRoleId ?? "",
        employeeId,
        startLocal: `${shiftDate}T${orchestration.data.shiftStartTime}`,
        endLocal: `${shiftDate}T${orchestration.data.shiftEndTime}`,
        breakMinutes: orchestration.data.shiftBreakMinutes,
        notes: "Created during employee onboarding",
        overrideWarnings: orchestration.data.overrideWarnings,
      });
      shift.state = "success";
      shift.message = "First shift was added to the draft schedule. Publish the schedule when it is ready.";
      schedulePath = `/schedule?location=${encodeURIComponent(locationId)}&week=${weekStart}`;
    } catch (error) {
      shift.state = "failed";
      shift.message = `Employee was created, but the first shift failed: ${errorMessage(error)}`;
    }
  }

  const workSetup: FollowOnResult = orchestration.data.workLocationId
    ? {
      state: "success",
      message: "Workplace choices were validated and used to prepare this onboarding flow; they are not stored as a primary employee assignment.",
    }
    : {
      state: "skipped",
      message: "No workplace choice was recorded. Employee records do not currently have a primary location or department relationship.",
    };

  const appAccess: FollowOnResult = orchestration.data.appAccess === "give-now"
    ? { state: "pending", message: "Sending app invitation…" }
    : orchestration.data.appAccess === "later"
      ? { state: "skipped", message: "App access was deferred for later setup." }
      : { state: "skipped", message: "This employee does not need app access." };

  if (orchestration.data.appAccess === "give-now") {
    try {
      const { supabase, user } = await requireUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      const result = await inviteEmployeeById({
        organizationId: context.organization.id,
        employeeId,
        actingProfileId: profile?.id ?? null,
        userSupabase: supabase,
        admin: createAdminClient(),
        siteUrl: getPublicEnvironment().NEXT_PUBLIC_SITE_URL,
      });
      switch (result.kind) {
        case "sent":
          appAccess.state = "success";
          appAccess.message = `Invitation email sent to ${result.email}.`;
          break;
        case "already-has-access":
          appAccess.state = "success";
          appAccess.message = `${result.email} already has app access.`;
          break;
        case "email-already-registered":
          appAccess.state = "success";
          appAccess.message = `${result.email} already has an account — they can sign in and will be linked automatically.`;
          break;
        case "not-found":
          appAccess.state = "failed";
          appAccess.message = "Employee was created, but invitation failed: employee not found.";
          break;
        case "error":
          appAccess.state = "failed";
          appAccess.message = `Employee was created, but invitation failed: ${result.message}`;
          break;
      }
    } catch (error) {
      appAccess.state = "failed";
      appAccess.message = `Employee was created, but invitation failed: ${errorMessage(error)}`;
    }
  }

  const hasFollowOnFailure = crew.state === "failed" || shift.state === "failed" || appAccess.state === "failed";
  revalidatePath("/employees");
  revalidatePath("/crews");
  revalidatePath("/schedule");
  revalidatePath("/my-schedule");

  return {
    outcome: "complete",
    message: hasFollowOnFailure
      ? "Employee created successfully. One or more optional follow-on steps need attention."
      : "Employee onboarding completed successfully.",
    employeeId,
    employeeName: `${employee.data.firstName} ${employee.data.lastName}`,
    workSetup,
    appAccess,
    crew,
    shift,
    schedulePath,
  };
}