import { z } from "zod";
import { validateJobWindow } from "@/modules/field-operations/validation/rules";

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Use a valid date and time.");
const optionalUuid = z.preprocess((value) => value === "" || value === undefined ? null : value, uuid.nullable());
const optionalDate = z.preprocess((value) => value === "" || value === undefined ? null : value, date.nullable());
const checkbox = z.preprocess((value) => value === "on" || value === true, z.boolean());

export const crewCreateSchema = z.object({
  organizationId: uuid,
  name: z.string().trim().min(1).max(120),
  crewLeaderId: optionalUuid,
});

export const crewUpdateSchema = z.object({
  crewId: uuid,
  name: z.string().trim().min(1).max(120),
  crewLeaderId: optionalUuid,
  active: checkbox,
});

export const crewMembershipSchema = z.object({
  crewId: uuid,
  employeeId: uuid,
  effectiveFrom: date,
  effectiveUntil: optionalDate,
}).refine((value) => value.effectiveUntil === null || value.effectiveUntil >= value.effectiveFrom, {
  path: ["effectiveUntil"], message: "Membership end must be on or after its start.",
});

export const crewMembershipEndSchema = z.object({ membershipId: uuid, effectiveUntil: date });

const jobDetails = z.object({
  customerName: z.string().trim().min(1).max(160),
  jobName: z.string().trim().min(1).max(160),
  locationId: optionalUuid,
  address: z.string().trim().min(1).max(500),
  scheduledStartLocal: localDateTime,
  scheduledEndLocal: localDateTime,
  notes: z.string().trim().max(4000),
}).superRefine((value, context) => {
  try { validateJobWindow(value.scheduledStartLocal, value.scheduledEndLocal); }
  catch (error) { context.addIssue({ code: "custom", path: ["scheduledEndLocal"], message: (error as Error).message }); }
});

export const jobCreateSchema = jobDetails.safeExtend({
  organizationId: uuid,
  status: z.enum(["draft", "scheduled"]),
});
export const jobUpdateSchema = jobDetails.safeExtend({ jobId: uuid });
export const jobStatusSchema = z.object({
  jobId: uuid,
  status: z.enum(["draft", "scheduled", "in_progress", "completed", "cancelled"]),
});
export const jobAssignmentSchema = z.object({
  jobId: uuid,
  crewId: optionalUuid,
  employeeId: optionalUuid,
}).refine((value) => Number(Boolean(value.crewId)) + Number(Boolean(value.employeeId)) === 1, {
  message: "Choose exactly one crew or employee assignment target.",
});
export const jobUnassignmentSchema = z.object({ assignmentId: uuid });
