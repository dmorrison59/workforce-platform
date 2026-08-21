import { describe, expect, it } from "vitest";
import { availabilitySchema } from "@/modules/availability/validation/schemas";

const base = {
  organizationId: "10000000-0000-4000-8000-000000000000",
  dayOfWeek: "1",
  available: "on",
  startTime: "09:00",
  endTime: "17:00",
  effectiveFrom: "2026-08-24",
  effectiveUntil: "",
};

describe("availability validation", () => {
  it("accepts a valid effective weekly availability period", () => {
    expect(availabilitySchema.safeParse(base).success).toBe(true);
  });

  it("accepts an unavailable day without times", () => {
    const result = availabilitySchema.safeParse({ ...base, available: undefined, startTime: "", endTime: "" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid weekdays, reversed times, and reversed effective dates", () => {
    expect(availabilitySchema.safeParse({ ...base, dayOfWeek: "8" }).success).toBe(false);
    expect(availabilitySchema.safeParse({ ...base, startTime: "17:00", endTime: "09:00" }).success).toBe(false);
    expect(availabilitySchema.safeParse({ ...base, effectiveUntil: "2026-08-23" }).success).toBe(false);
  });
});

