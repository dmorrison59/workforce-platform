import { createAdminClient } from "@/lib/supabase/admin";

export const EVENT_TYPES = {
  employeeCreated: "employee.created",
  invitationSent: "employee.invitation_sent",
  schedulePublished: "schedule.published",
  coverageRequested: "coverage.requested",
  timeEntryApproved: "time_entry.approved",
} as const;

export async function recordEvent(args: {
  organizationId: string;
  eventType: string;
  actorProfileId?: string | null;
  subjectEmployeeId?: string | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    /* eslint-disable @typescript-eslint/no-explicit-any */
    // The committed Database types predate domain_events; keep untyped until regenerated.
    const { error } = await (admin as any).from("domain_events").insert({
      organization_id: args.organizationId,
      event_type: args.eventType,
      actor_profile_id: args.actorProfileId ?? null,
      subject_employee_id: args.subjectEmployeeId ?? null,
      payload: args.payload ?? {},
    });
    if (error) console.error("domain_events insert failed:", error.message);
  } catch (error) {
    // Recording an event must never break the primary flow.
    console.error("domain_events insert threw:", error);
  }
}