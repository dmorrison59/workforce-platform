"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { requireOrganization } from "@/core/auth/context";
import { getStripe } from "@/core/billing/stripe";
import { PLANS, type PlanId } from "@/core/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const APP_URL = process.env.APP_URL ?? "https://yardclock.com";

export async function startCheckoutAction(formData: FormData) {
  const plan = String(formData.get("plan") ?? "") as PlanId;
  const price = PLANS[plan];
  if (!price) throw new Error("Unknown plan");
  const context = await requireOrganization();
  const org = context.organization as any;
  const stripe = getStripe();

  let customerId = org.stripe_customer_id as string | null;
  if (!customerId) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const customer = await stripe.customers.create({
      email: data.user?.email ?? undefined,
      metadata: { organization_id: org.id },
    });
    customerId = customer.id;
    const admin = createAdminClient();
    await (admin as any)
      .from("organizations")
      .update({ stripe_customer_id: customerId })
      .eq("id", org.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: price.priceId, quantity: 1 }],
    success_url: `${APP_URL}/billing?status=success`,
    cancel_url: `${APP_URL}/billing?status=canceled`,
    metadata: { organization_id: org.id },
    subscription_data: { metadata: { organization_id: org.id } },
  });

  redirect(session.url ?? "/billing");
}

export async function startPortalAction() {
  const context = await requireOrganization();
  const org = context.organization as any;
  if (!org.stripe_customer_id) throw new Error("No billing account yet");
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${APP_URL}/billing`,
  });
  redirect(session.url);
}