import { z } from "zod";

const uuid = z.string().uuid("Select a valid record.");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");
const localDateTime = z.string().regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
  "Use a valid date and time.",
);
const optionalUuid = z.string().transform((value) => value || null).pipe(z.union([z.string().uuid(), z.null()]));

/**
 * The wizard's optional "Crew Assignment" step. Only parsed when the wizard
 * submission opts in via `includeCrew` — see `wantsCrewAssignment`.
 */
export const onboardingCrewSchema = z.object({
  crewId: uuid,
  effectiveFrom: date,
});

/**
 * The wizard's optional "First Schedule" step. Reuses the same shift shape
 * the Scheduling module already validates, minus organization/employee IDs
 * which the orchestration action supplies itself.
 */
export const onboardingScheduleSchema = z.object({
  locationId: uuid,
  departmentId: uuid,
  roleId: optionalUuid,
  weekStart: date.refine((value) => new Date(`${value}T00:00:00Z`).getUTCDay() === 1, "Week must start on Monday."),
  startLocal: localDateTime,
  endLocal: localDateTime,
  breakMinutes: z.coerce.number().int("Break must use whole minutes.").min(0, "Break cannot be negative."),
  notes: z.string().trim().max(2000, "Notes must be 2,000 characters or fewer.").optional().default(""),
}).superRefine((value, context) => {
  if (value.endLocal <= value.startLocal) {
    context.addIssue({ code: "custom", path: ["endLocal"], message: "End time must be after start time." });
  }
});

/** Mirrors the checkbox convention already used for `overrideWarnings` elsewhere in the app. */
export function wantsCrewAssignment(values: Record<string, FormDataEntryValue>) {
  return values.includeCrew === "on" || values.includeCrew === "true";
}

export function wantsFirstSchedule(values: Record<string, FormDataEntryValue>) {
  return values.includeSchedule === "on" || values.includeSchedule === "true";
}
