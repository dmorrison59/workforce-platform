import { describe, expect, it } from "vitest";
import { haversineDistanceM } from "@/modules/field-clock/services/distance";

describe("haversineDistanceM", () => {
  it("returns zero for the same point", () => {
    expect(haversineDistanceM(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
  });

  it("calculates a known short field distance", () => {
    const distance = haversineDistanceM(40.7128, -74.006, 40.7137, -74.006);
    expect(distance).toBeGreaterThan(99);
    expect(distance).toBeLessThan(101);
  });
});
