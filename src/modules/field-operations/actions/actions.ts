"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireOrganization } from "@/core/auth/context";
import { requireCapability } from "@/core/permissions/capabilities";
import { formValues, redirectWithMessage } from "@/core/shared/forms";
import * as crews from "@/modules/field-operations/services/crew-service";
import * as jobs from "@/modules/field-operations/services/job-service";

function errorMessage(error: unknown) {
  if (error instanceof ZodError) return error.issues[0]?.message ?? "Invalid field-operation details.";
  return error instanceof Error ? error.message : "The field-operation change could not be completed.";
}

async function mutate(
  path: "/crews" | "/jobs",
  capability: "crew.manage" | "job.manage" | "job.assign",
  formData: FormData,
  operation: (values: Record<string, FormDataEntryValue> & { organizationId: string }) => Promise<unknown>,
  success: string,
) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, capability);
  try {
    await operation({ ...formValues(formData), organizationId: context.organization.id });
  } catch (error) {
    redirectWithMessage(path, "error", errorMessage(error));
  }
  revalidatePath("/crews");
  revalidatePath("/jobs");
  revalidatePath("/my-jobs");
  redirectWithMessage(path, "message", success);
}

export async function createCrewAction(formData: FormData) {
  await mutate("/crews", "crew.manage", formData, crews.createCrew, "Crew created.");
}
export async function updateCrewAction(formData: FormData) {
  await mutate("/crews", "crew.manage", formData, crews.updateCrew, "Crew updated.");
}
export async function addCrewMemberAction(formData: FormData) {
  await mutate("/crews", "crew.manage", formData, crews.addCrewMember, "Crew member added.");
}
export async function endCrewMembershipAction(formData: FormData) {
  await mutate("/crews", "crew.manage", formData, crews.endCrewMembership, "Crew membership ended.");
}
export async function createJobAction(formData: FormData) {
  await mutate("/jobs", "job.manage", formData, jobs.createJob, "Job created.");
}
export async function updateJobAction(formData: FormData) {
  await mutate("/jobs", "job.manage", formData, jobs.updateJob, "Job updated.");
}
export async function changeJobStatusAction(formData: FormData) {
  await mutate("/jobs", "job.manage", formData, jobs.changeJobStatus, "Job status updated.");
}
export async function assignJobAction(formData: FormData) {
  await mutate("/jobs", "job.assign", formData, jobs.assignJob, "Job assignment added.");
}
export async function unassignJobAction(formData: FormData) {
  await mutate("/jobs", "job.assign", formData, jobs.unassignJob, "Job assignment removed.");
}
