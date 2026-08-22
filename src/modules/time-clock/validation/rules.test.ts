import { describe, expect, it } from "vitest";
import { capabilities } from "@/core/permissions/capabilities";
import {
  clockInError,
  clockOutError,
  endBreakError,
  startBreakError,
} from "@/modules/time-clock/validation/rules";

describe("Gate 4 time-clock transitions", () => {
  it("permits one open entry per employee", () => {
    expect(clockInError(false)).toBeNull();
    expect(clockInError(true)).toContain("already has an open time entry");
  });

  it("requires an open entry and a closed break to clock out", () => {
    expect(clockOutError(true, false)).toBeNull();
    expect(clockOutError(false, false)).toContain("No open time entry");
    expect(clockOutError(true, true)).toContain("End the active break");
  });

  it("allows only valid break transitions", () => {
    expect(startBreakError(true, false)).toBeNull();
    expect(startBreakError(false, false)).toContain("Clock in");
    expect(startBreakError(true, true)).toContain("already active");
    expect(endBreakError(true, true)).toBeNull();
    expect(endBreakError(false, false)).toContain("No open time entry");
    expect(endBreakError(true, false)).toContain("No active break");
  });

  it("registers all Gate 4 capabilities", () => {
    expect(capabilities).toEqual(expect.arrayContaining([
      "timeclock.use",
      "timeclock.view_self",
      "timeclock.view",
      "timeclock.edit",
    ]));
  });
});
