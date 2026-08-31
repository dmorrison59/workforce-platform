/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireOrganization } from "@/core/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS, type PlanId } from "@/core/billing/plans";
import { startCheckoutAction, startPortalAction } from "@/modules/billing/actions";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const context = await requireOrganization();
  const org = context.organization as any;
  const admin = createAdminClient();
  const { count } = await (admin as any)
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id);

  const active = org.plan_status === "active";
  const currentPlan = active ? (PLANS[org.plan as PlanId] ?? null) : null;

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <header style={{ display: "grid", gap: "0.25rem" }}>
        <p style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.75rem", color: "#64748b" }}>
          Billing
        </p>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>Plans & billing</h1>
        <p>
          Current plan: <strong>{currentPlan ? currentPlan.name : "Trial"}</strong> · Employees: {count ?? 0}
        </p>
        {org.stripe_subscription_id ? (
          <form action={startPortalAction}>
            <button type="submit" style={{ padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>
              Manage payment / cancel
            </button>
          </form>
        ) : null}
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        {(Object.keys(PLANS) as PlanId[]).map((id) => {
          const p = PLANS[id];
          const isCurrent = currentPlan?.name === p.name;
          return (
            <div
              key={id}
              style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "1rem", display: "grid", gap: "0.5rem", background: "#fff", alignContent: "start" }}
            >
              <h2 style={{ fontWeight: 700 }}>{p.name}</h2>
              <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
                ${p.monthly}
                <span style={{ fontSize: "0.875rem", fontWeight: 400 }}>/mo</span>
              </p>
              <p style={{ color: "#475569" }}>{p.blurb}</p>
              <form action={startCheckoutAction}>
                <input type="hidden" name="plan" value={id} />
                <button
                  type="submit"
                  disabled={isCurrent}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: 8,
                    border: "1px solid #4f46e5",
                    background: isCurrent ? "#e2e8f0" : "#4f46e5",
                    color: isCurrent ? "#475569" : "#fff",
                    cursor: isCurrent ? "default" : "pointer",
                  }}
                >
                  {isCurrent ? "Current plan" : `Choose ${p.name}`}
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}