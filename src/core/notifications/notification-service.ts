/* eslint-disable @typescript-eslint/no-explicit-any */
// The committed Database types predate domain_events; keep untyped until regenerated.
import { createAdminClient } from "@/lib/supabase/admin";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "YardClock <invites@yardclock.com>";

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.error("[notify] RESEND_API_KEY is missing. Skipping email.");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });

  if (!res.ok) {
    console.error("[notify] Resend failed:", await res.text());
  } else {
    console.log(`[notify] emailed ${to}: ${subject}`);
  }
}

export async function processPendingNotifications() {
  const admin = createAdminClient();

  const { data: events, error } = await (admin as any)
    .from("domain_events")
    .select("*")
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(10);

  if (error) {
    console.error("[notify] read failed:", error.message);
    return;
  }
  if (!events || events.length === 0) return;

  for (const event of events) {
    try {
      console.log(`[notify] processing ${event.event_type}`);
      await handleEvent(event);
      await (admin as any)
        .from("domain_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", event.id);
    } catch (err) {
      console.error(`[notify] failed to process event ${event.id}:`, err);
    }
  }
}

async function handleEvent(event: any) {
  const admin = createAdminClient();

  switch (event.event_type) {
    case "schedule.published": {
      const { data: employees } = await (admin as any)
        .from("employees")
        .select("email, first_name")
        .eq("organization_id", event.organization_id)
        .not("email", "is", null);

      if (!employees) break;

      for (const emp of employees) {
        await sendEmail(
          emp.email,
          "Your schedule is published",
          `<p>Hey ${emp.first_name},</p><p>Your boss just published the schedule. Open the app to see your shifts for the week.</p>`,
        );
      }
      break;
    }

    case "time_entry.approved": {
      if (!event.subject_employee_id) break;
      const { data: emp } = await (admin as any)
        .from("employees")
        .select("email, first_name")
        .eq("id", event.subject_employee_id)
        .single();

      if (emp?.email) {
        await sendEmail(
          emp.email,
          "Your timesheet was approved",
          `<p>Hey ${emp.first_name},</p><p>Your recent time entry was approved by your manager.</p>`,
        );
      }
      break;
    }

    default:
      console.log(`[notify] no handler for ${event.event_type}`);
  }
}