import { describe, expect, it } from "vitest";
import { capabilities } from "@/core/permissions/capabilities";
import { shiftSchema, weeklyScheduleSchema } from "@/modules/scheduling/validation/schemas";

const validShift = {
  organizationId: "10000000-0000-4000-8000-000000000000",
  scheduleId: "10000000-0000-4000-8000-000000000001",
  departmentId: "10000000-0000-4000-8000-000000000002",
  roleId: "",
  employeeId: "",
  startLocal: "2026-08-24T09:00",
  endLocal: "2026-08-24T17:00",
  breakMinutes: "30",
  notes: "Front desk",
  overrideWarnings: false,
};

describe("Gate 1 scheduling validation", () => {
  it("accepts Monday schedule starts and rejects other weekdays", () => {
    expect(weeklyScheduleSchema.safeParse({
      organizationId: "10000000-0000-4000-8000-000000000000",
      locationId: "10000000-0000-4000-8000-000000000001",
      weekStart: "2026-08-24",
    }).success).toBe(true);
    expect(weeklyScheduleSchema.safeParse({
      organizationId: "10000000-0000-4000-8000-000000000000",
      locationId: "10000000-0000-4000-8000-000000000001",
      weekStart: "2026-08-25",
    }).success).toBe(false);
  });

  it("accepts a valid shift and normalizes optional assignments", () => {
    const result = shiftSchema.safeParse(validShift);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.employeeId).toBeNull();
      expect(result.data.breakMinutes).toBe(30);
    }
  });

  it("rejects reversed times, negative breaks, and breaks longer than the shift", () => {
    expect(shiftSchema.safeParse({ ...validShift, endLocal: "2026-08-24T08:00" }).success).toBe(false);
    expect(shiftSchema.safeParse({ ...validShift, breakMinutes: "-1" }).success).toBe(false);
    expect(shiftSchema.safeParse({ ...validShift, breakMinutes: "600" }).success).toBe(false);
  });

  it("registers all scheduling capabilities", () => {
    expect(capabilities).toEqual(expect.arrayContaining([
      "schedule.view", "schedule.manage", "schedule.publish",
    ]));
  });
});
