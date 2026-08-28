import { describe, expect, it } from "vitest";
import { orgDayWindow } from "./day-window";

describe("orgDayWindow", () => {
  it("computes the org-local day window", () => {
    const window = orgDayWindow("America/New_York", new Date("2026-08-26T12:00:00Z"));
    expect(window.day).toBe("2026-08-26");
    expect(window.start).toBe("2026-08-26T04:00:00.000Z");
    expect(window.end).toBe("2026-08-27T04:00:00.000Z");
  });

  it("keeps the org day when UTC has already rolled over", () => {
    const window = orgDayWindow("America/New_York", new Date("2026-08-27T02:00:00Z"));
    expect(window.day).toBe("2026-08-26");
  });

  it("handles half-hour offsets", () => {
    const window = orgDayWindow("Asia/Kolkata", new Date("2026-08-26T12:00:00Z"));
    expect(window.day).toBe("2026-08-26");
    expect(window.start).toBe("2026-08-25T18:30:00.000Z");
  });

  it("handles a DST spring-forward day (23h)", () => {
    const window = orgDayWindow("America/New_York", new Date("2026-03-08T12:00:00Z"));
    expect(window.start).toBe("2026-03-08T05:00:00.000Z");
    expect(window.end).toBe("2026-03-09T04:00:00.000Z");
  });
});