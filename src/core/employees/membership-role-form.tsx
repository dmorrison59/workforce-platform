"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { updateMembershipRole } from "./role-actions";
import { roleLabel, type OrganizationRole } from "./role-schema";

function SaveRoleButton({ unchanged }: { unchanged: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="button secondary" type="submit" disabled={pending || unchanged}>
      {pending ? "Saving…" : "Save role"}
    </button>
  );
}

export function MembershipRoleForm({
  membershipId,
  currentRole,
  availableRoles,
  isLastOwner,
}: {
  membershipId: string;
  currentRole: OrganizationRole;
  availableRoles: OrganizationRole[];
  isLastOwner: boolean;
}) {
  const [selectedRole, setSelectedRole] = useState<OrganizationRole>(currentRole);
  const promotesToOwner = selectedRole === "owner" && currentRole !== "owner";
  const lastOwnerDemotion = isLastOwner && selectedRole !== "owner";

  return (
    <div className="role-access">
      <strong>Access &amp; Role</strong>
      <span className="muted">Current: {roleLabel(currentRole)}</span>
      <form action={updateMembershipRole} className="role-form">
        <input type="hidden" name="membershipId" value={membershipId} />
        <label>
          <span className="sr-only">Organization role</span>
          <select
            name="role"
            value={selectedRole}
            onChange={(event) => setSelectedRole(event.target.value as OrganizationRole)}
          >
            {availableRoles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
          </select>
        </label>
        {promotesToOwner && (
          <label className="role-warning">
            <input type="checkbox" name="ownerConfirmation" value="confirmed" required />
            <span>
              Owners have full administrative access to this organization, including employees,
              scheduling, settings, and other protected functions. I confirm this promotion.
            </span>
          </label>
        )}
        {lastOwnerDemotion && (
          <span className="role-warning" role="alert">
            Promote another active member to Owner before changing this role.
          </span>
        )}
        <SaveRoleButton unchanged={selectedRole === currentRole || lastOwnerDemotion} />
      </form>
    </div>
  );
}
