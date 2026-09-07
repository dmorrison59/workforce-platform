import { describe, expect, it } from "vitest";
import { membershipRoleChangeSchema, roleLabel } from "./role-schema";

const membershipId = "00000000-0000-4000-8000-000000000001";

describe("membership role change validation", () => {
  it.each(["employee", "manager"])("accepts %s without elevated-access confirmation", (role) => {
    expect(membershipRoleChangeSchema.safeParse({ membershipId, role }).success).toBe(true);
  });

  it("requires explicit confirmation before granting Owner access", () => {
    const result = membershipRoleChangeSchema.safeParse({ membershipId, role: "owner" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toContain("full organization control");
  });

  it("accepts Owner only with the expected confirmation value", () => {
    expect(membershipRoleChangeSchema.safeParse({ membershipId, role: "owner", ownerConfirmation: "confirmed" }).success).toBe(true);
  });

  it.each(["supervisor", "", "OWNER"])("rejects unsupported role %s", (role) => {
    expect(membershipRoleChangeSchema.safeParse({ membershipId, role }).success).toBe(false);
  });

  it("rejects an invalid membership identifier", () => {
    expect(membershipRoleChangeSchema.safeParse({ membershipId: "not-an-id", role: "employee" }).success).toBe(false);
  });

  it("formats stable role labels", () => {
    expect(roleLabel("manager")).toBe("Manager");
  });
});
