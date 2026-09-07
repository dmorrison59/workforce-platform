import { describe, expect, it } from "vitest";
import { membershipRoleChangeMessage } from "./role-service";

describe("membership role error messages", () => {
  it("preserves the actionable final Owner explanation", () => {
    expect(membershipRoleChangeMessage({ code: "23514", message: "This organization must always have at least one Owner." }))
      .toContain("Promote another Owner");
  });

  it("does not expose unexpected database errors", () => {
    expect(membershipRoleChangeMessage({ code: "XX000", message: "internal relation detail" }))
      .toBe("The role could not be changed. Refresh the page and try again.");
  });

  it("maps authorization and target-state failures", () => {
    expect(membershipRoleChangeMessage({ code: "42501", message: "denied" })).toContain("Only an Owner");
    expect(membershipRoleChangeMessage({ message: "Only active organization memberships can change roles." })).toContain("active organization members");
    expect(membershipRoleChangeMessage({ message: "Organization membership not found." })).toContain("could not be found");
  });
});
