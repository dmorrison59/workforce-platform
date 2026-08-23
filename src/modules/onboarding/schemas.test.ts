import { describe, expect, it } from "vitest";
import {
  onboardingCrewSchema,
  onboardingScheduleSchema,
  wantsCrewAssignment,
  wantsFirstSchedule,
} from "@/modules/onboarding/schemas";

const crewId = "10000000-0000-4000-8000-000000000010";
const locationId = "10000000-0000-4000-8000-000000000011";
const departmentId = "10000000-0000-4000-8000-000000000012";

describe("onboarding wizard opt-in toggles", () => {
  it("treats the crew and schedule steps as opted-out unless explicitly included", () => {
    expect(wantsCrewAssignment({})).toBe(false);
    expect(wantsCrewAssignment({ includeCrew: "off" })).toBe(false);
    expect(wantsCrewAssignment({ includeCrew: "on" })).toBe(true);
    expect(wantsCrewAssignment({ includeCrew: "true" })).toBe(true);

    expect(wantsFirstSchedule({})).toBe(false);
    expect(wantsFirstSchedule({ includeSchedule: "on" })).toBe(true);
  });
});

describe("onboardingCrewSchema", () => {
  it("requires a crew and a start date", () => {
    expect(onboardingCrewSchema.safeParse({ crewId, effectiveFrom: "2026-08-24" }).success).toBe(true);
    expect(onboardingCrewSchema.safeParse({ crewId: "not-a-uuid", effectiveFrom: "2026-08-24" }).success).toBe(false);
    expect(onboardingCrewSchema.safeParse({ crewId, effectiveFrom: "not-a-date" }).success).toBe(false);
  });
});

describe("onboardingScheduleSchema", () => {
  const base = {
    locationId,
    departmentId,
    roleId: "",
    weekStart: "2026-08-24",
    startLocal: "2026-08-24T09:00",
    endLocal: "2026-08-24T17:00",
    breakMinutes: "30",
    notes: "",
  };

  it("accepts a valid first-shift submission and normalizes the optional role", () => {
    const result = onboardingScheduleSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.roleId).toBeNull();
      expect(result.data.breakMinutes).toBe(30);
    }
  });

  it("rejects a week start that is not a Monday", () => {
    expect(onboardingScheduleSchema.safeParse({ ...base, weekStart: "2026-08-25" }).success).toBe(false);
  });

  it("rejects an end time that is not after the start time", () => {
    expect(onboardingScheduleSchema.safeParse({ ...base, endLocal: "2026-08-24T08:00" }).success).toBe(false);
  });
});
