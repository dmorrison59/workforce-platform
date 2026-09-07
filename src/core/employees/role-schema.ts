import { z } from "zod";

export const organizationRoleSchema = z.enum(["employee", "manager", "owner"]);
export type OrganizationRole = z.infer<typeof organizationRoleSchema>;

export const membershipRoleChangeSchema = z.object({
  membershipId: z.uuid("A valid organization membership is required."),
  role: organizationRoleSchema,
  ownerConfirmation: z.string().optional(),
}).superRefine((value, context) => {
  if (value.role === "owner" && value.ownerConfirmation !== "confirmed") {
    context.addIssue({
      code: "custom",
      path: ["ownerConfirmation"],
      message: "Confirm that Owner access grants full organization control.",
    });
  }
});

export function roleLabel(role: OrganizationRole) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}
