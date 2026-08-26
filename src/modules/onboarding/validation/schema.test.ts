import { describe, expect, it } from "vitest";
import { onboardingOrchestrationSchema } from "./schema";

const locationId = "10000000-0000-4000-8000-000000000001";
const departmentId = "10000000-0000-4000-8000-000000000002";

describe("onboarding orchestration validation", () => {
  it("accepts the minimal flow with optional follow-ons skipped", () => {
    const result = onboardingOrchestrationSchema.safeParse({
      appAccess: "later",
      workLocationId: "",
      workDepartmentId: "",
      crewId: "",
      crewEffectiveFrom: "",
      createFirstShift: false,
      shiftLocationId: "",
      shiftDepartmentId: "",
      shiftRoleId: "",
      shiftDate: "",
      shiftStartTime: "",
      shiftEndTime: "",
      shiftBreakMinutes: "0",
      overrideWarnings: false,
    });
    expect(result.success).toBe(true);
  });

  it("requires paired work setup values and effective-dated crew membership", () => {
    const result = onboardingOrchestrationSchema.safeParse({
      appAccess: "none",
      workLocationId: locationId,
      workDepartmentId: "",
      crewId: locationId,
      crewEffectiveFrom: "",
      createFirstShift: false,
      shiftBreakMinutes: "0",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(expect.arrayContaining([
      "workDepartmentId",
      "crewEffectiveFrom",
    ]));
  });

  it("validates a requested first shift without bypassing scheduling inputs", () => {
    const valid = onboardingOrchestrationSchema.safeParse({
      appAccess: "give-now",
      workLocationId: locationId,
      workDepartmentId: departmentId,
      crewId: "",
      crewEffectiveFrom: "",
      createFirstShift: "on",
      shiftLocationId: locationId,
      shiftDepartmentId: departmentId,
      shiftRoleId: "",
      shiftDate: "2026-08-24",
      shiftStartTime: "09:00",
      shiftEndTime: "17:00",
      shiftBreakMinutes: "30",
      overrideWarnings: false,
    });
    expect(valid.success).toBe(true);

    const invalid = onboardingOrchestrationSchema.safeParse({
      appAccess: "give-now",
      workLocationId: "",
      workDepartmentId: "",
      crewId: "",
      crewEffectiveFrom: "",
      createFirstShift: "on",
      shiftLocationId: locationId,
      shiftDepartmentId: departmentId,
      shiftRoleId: "",
      shiftDate: "2026-08-24",
      shiftStartTime: "17:00",
      shiftEndTime: "09:00",
      shiftBreakMinutes: "0",
      overrideWarnings: false,
    });
    expect(invalid.success).toBe(false);
    expect(invalid.error?.issues[0]?.message).toBe("End time must be after start time.");
  });
});
