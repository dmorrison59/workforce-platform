/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getStripe } from "@/core/billing/stripe";
import { PLAN_BY_PRICE_ID, type PlanId } from "@/core/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const orgId = session.metadata?.organization_id;
        if (!orgId) break;

        let subscriptionId: string | null = null;
        let priceId: string | null = null;
        if (session.subscription) {
          const subId =
            typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          subscriptionId = sub.id;
          priceId = sub.items.data[0]?.price?.id ?? null;
        }
        const customerId =
          typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);
        const plan: PlanId = (priceId && PLAN_BY_PRICE_ID[priceId]) || "starter";

        await (admin as any)
          .from("organizations")
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            stripe_price_id: priceId,
            plan,
            plan_status: "active",
          })
          .eq("id", orgId);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as any; // Bypasses strict Stripe v22 typing
        let orgId: string | null = sub.metadata?.organization_id ?? null;
        if (!orgId) {
          const { data } = await (admin as any)
            .from("organizations")
            .select("id")
            .eq("stripe_subscription_id", sub.id)
            .single();
          orgId = data?.id ?? null;
        }
        if (!orgId) break;

        const priceId = sub.items?.data?.[0]?.price?.id ?? null;
        const plan: PlanId = (priceId && PLAN_BY_PRICE_ID[priceId]) || "starter";
        await (admin as any)
          .from("organizations")
          .update({
            stripe_subscription_id: sub.id,
            stripe_price_id: priceId,
            plan,
            plan_status: sub.status,
            current_period_end: sub.current_period_end
              ? new Date(sub.current_period_end * 1000).toISOString()
              : null,
          })
          .eq("id", orgId);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const { data } = await (admin as any)
          .from("organizations")
          .select("id")
          .eq("stripe_subscription_id", sub.id)
          .single();
        if (data) {
          await (admin as any)
            .from("organizations")
            .update({ plan: "trial", plan_status: "canceled", stripe_subscription_id: null })
            .eq("id", data.id);
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] failed:", err);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}