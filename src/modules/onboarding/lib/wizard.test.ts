import { describe, expect, it } from "vitest";
import {
  addressValidationMessage,
  appAccessSummary,
  mergeWizardValues,
  onboardingSteps,
  reviewSummary,
  skippedStepValues,
} from "./wizard";

describe("employee onboarding wizard mapping", () => {
  it("keeps required and optional progression explicit", () => {
    expect(onboardingSteps.map((step) => step.id)).toEqual([
      "details", "address", "work", "access", "crew", "schedule", "review",
    ]);
    expect(onboardingSteps.filter((step) => step.optional).map((step) => step.id)).toEqual(["crew", "schedule"]);
  });

  it("preserves prior values while later steps add data", () => {
    const details = { firstName: "Jordan", lastName: "Employee", email: "jordan@example.com" };
    expect(mergeWizardValues(details, { city: "Sampleville" })).toEqual({ ...details, city: "Sampleville" });
  });

  it("validates a manually entered structured address", () => {
    expect(addressValidationMessage({ streetAddress: "100 Test Ave", city: "", stateProvince: "NY", postalCode: "10001", country: "United States" }))
      .toBe("City is required when adding an address.");
    expect(addressValidationMessage({ streetAddress: "100 Test Ave", city: "Sampleville", stateProvince: "NY", postalCode: "10001", country: "United States" }))
      .toBeNull();
    expect(addressValidationMessage({})).toBeNull();
  });

  it("maps app-access choices without creating credentials", () => {
    expect(appAccessSummary("give-now")).toContain("pending");
    expect(appAccessSummary("later")).toContain("deferred");
    expect(appAccessSummary("none")).toContain("No app access");
  });

  it("clears optional values when a step is skipped", () => {
    expect(skippedStepValues("crew")).toEqual({ crewId: "", crewEffectiveFrom: "" });
    expect(skippedStepValues("schedule")).toMatchObject({ createFirstShift: "", shiftLocationId: "" });
  });

  it("only includes wage details in an authorized review", () => {
    const values = {
      firstName: "Jordan",
      lastName: "Employee",
      email: "jordan@example.com",
      hourlyRate: "28.5",
      employmentStatus: "active",
      appAccess: "later",
    };
    expect(reviewSummary(values, true).hourlyRate).toBe("$28.50/hour");
    expect(reviewSummary(values, false).hourlyRate).toBeNull();
  });
});
