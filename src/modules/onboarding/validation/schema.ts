import { z } from "zod";

const uuid = z.string().uuid("Select a valid record.");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");
const time = z.string().regex(/^\d{2}:\d{2}$/, "Use a valid time.");
const optionalUuid = z.preprocess((value) => value === "" || value === undefined ? null : value, uuid.nullable());
const optionalDate = z.preprocess((value) => value === "" || value === undefined ? null : value, date.nullable());
const optionalTime = z.preprocess((value) => value === "" || value === undefined ? null : value, time.nullable());
const checkbox = z.preprocess((value) => value === "on" || value === true, z.boolean());

export const onboardingOrchestrationSchema = z.object({
  appAccess: z.enum(["give-now", "later", "none"], { message: "Choose an app-access option." }),
  workLocationId: optionalUuid,
  workDepartmentId: optionalUuid,
  crewId: optionalUuid,
  crewEffectiveFrom: optionalDate,
  createFirstShift: checkbox,
  shiftLocationId: optionalUuid,
  shiftDepartmentId: optionalUuid,
  shiftRoleId: optionalUuid,
  shiftDate: optionalDate,
  shiftStartTime: optionalTime,
  shiftEndTime: optionalTime,
  shiftBreakMinutes: z.coerce.number().int("Break must use whole minutes.").min(0, "Break cannot be negative.").default(0),
  overrideWarnings: checkbox,
}).superRefine((value, context) => {
  if (Boolean(value.workLocationId) !== Boolean(value.workDepartmentId)) {
    context.addIssue({
      code: "custom",
      path: [value.workLocationId ? "workDepartmentId" : "workLocationId"],
      message: "Choose both a location and department for work setup.",
    });
  }
  if (value.crewId && !value.crewEffectiveFrom) {
    context.addIssue({ code: "custom", path: ["crewEffectiveFrom"], message: "Choose when crew membership begins." });
  }
  if (!value.createFirstShift) return;

  const required = [
    ["shiftLocationId", value.shiftLocationId, "Choose a shift location."],
    ["shiftDepartmentId", value.shiftDepartmentId, "Choose a shift department."],
    ["shiftDate", value.shiftDate, "Choose a shift date."],
    ["shiftStartTime", value.shiftStartTime, "Choose a start time."],
    ["shiftEndTime", value.shiftEndTime, "Choose an end time."],
  ] as const;
  required.forEach(([path, item, message]) => {
    if (!item) context.addIssue({ code: "custom", path: [path], message });
  });

  if (!value.shiftDate || !value.shiftStartTime || !value.shiftEndTime) return;
  const start = Date.parse(`${value.shiftDate}T${value.shiftStartTime}:00Z`);
  const end = Date.parse(`${value.shiftDate}T${value.shiftEndTime}:00Z`);
  if (end <= start) {
    context.addIssue({ code: "custom", path: ["shiftEndTime"], message: "End time must be after start time." });
    return;
  }
  if (value.shiftBreakMinutes > (end - start) / 60_000) {
    context.addIssue({ code: "custom", path: ["shiftBreakMinutes"], message: "Break cannot exceed the shift length." });
  }
});

export type OnboardingOrchestration = z.output<typeof onboardingOrchestrationSchema>;
