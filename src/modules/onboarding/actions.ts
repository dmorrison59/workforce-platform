"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireOrganization } from "@/core/auth/context";
import { createEmployee } from "@/core/employees/service";
import { employeeSchema } from "@/core/employees/schema";
import { requireCapability } from "@/core/permissions/capabilities";
import { formValues, redirectWithMessage } from "@/core/shared/forms";
import * as crews from "@/modules/field-operations/services/crew-service";
import { onboardingCrewSchema, onboardingScheduleSchema, wantsCrewAssignment, wantsFirstSchedule } from "@/modules/onboarding/schemas";
import * as scheduling from "@/modules/scheduling/services/scheduling-service";

function issueMessage(error: unknown, fallback: string) {
  if (error instanceof ZodError) return error.issues[0]?.message ?? fallback;
  return error instanceof Error ? error.message : fallback;
}

/**
 * Orchestrates the Employee Onboarding Wizard's final "Review & Finish" step.
 *
 * Per the wizard's rules, this coordinates the existing Employees, Crews, and
 * Scheduling services rather than re-implementing their business logic, and
 * never grants broader access than those services already enforce on their
 * own (this action re-checks employee.manage; crew and shift mutations still
 * go through crew.manage / schedule.manage checks inside those services).
 *
 * The employee record is the one piece of this flow that must succeed for
 * the wizard to have done anything at all. Crew assignment and the first
 * shift are both optional and, once the employee exists, failing either one
 * does not roll back the employee — instead the failure is reported back to
 * the manager explicitly instead of being silently dropped.
 */
export async function completeOnboardingAction(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "employee.manage");

  const values = formValues(formData);

  const parsedEmployee = employeeSchema.safeParse(values);
  if (!parsedEmployee.success) {
    redirectWithMessage(
      "/employees/new/wizard",
      "error",
      parsedEmployee.error.issues[0]?.message ?? "Check the employee details and try again.",
    );
  }

  let employeeId: string;
  try {
    employeeId = await createEmployee({ ...parsedEmployee.data, organizationId: context.organization.id });
  } catch (error) {
    redirectWithMessage("/employees/new/wizard", "error", issueMessage(error, "The employee could not be created."));
  }

  const notices: string[] = [];

  if (wantsCrewAssignment(values)) {
    try {
      const crew = onboardingCrewSchema.parse(values);
      await crews.addCrewMember({
        crewId: crew.crewId,
        employeeId,
        effectiveFrom: crew.effectiveFrom,
        effectiveUntil: null,
      });
    } catch (error) {
      notices.push(`Crew assignment was not completed (${issueMessage(error, "unknown error")}).`);
    }
  }

  if (wantsFirstSchedule(values)) {
    try {
      const shift = onboardingScheduleSchema.parse(values);
      const scheduleId = await scheduling.createWeeklySchedule({
        organizationId: context.organization.id,
        locationId: shift.locationId,
        weekStart: shift.weekStart,
      });
      await scheduling.createShift({
        organizationId: context.organization.id,
        scheduleId,
        departmentId: shift.departmentId,
        roleId: shift.roleId,
        employeeId,
        startLocal: shift.startLocal,
        endLocal: shift.endLocal,
        breakMinutes: shift.breakMinutes,
        notes: shift.notes,
        overrideWarnings: false,
      });
    } catch (error) {
      notices.push(`First shift was not created (${issueMessage(error, "unknown error")}).`);
    }
  }

  revalidatePath("/employees");
  revalidatePath("/crews");
  revalidatePath("/schedule");
  revalidatePath("/my-schedule");

  if (notices.length) {
    redirectWithMessage("/employees", "warning", `Employee added. ${notices.join(" ")}`);
  }
  redirectWithMessage("/employees", "message", "Employee added.");
}
